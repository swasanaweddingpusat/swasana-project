// Shared, Redis-cached resolver for Open Lines session response-time metrics.
//
// Three routes (percakapan, percakapan/export, response-sales) each walk
// `imopenlines.session.history.get` per session and derive response samples +
// transfer events locally — this is the app's heaviest Bitrix cost, and until
// now it was recomputed on every page view. This helper caches the PARSED
// result per session in Redis (see lib/redis.ts — non-fatal, no TTL).
//
// Cache key: `bitrix:session-metrics:<sessionId>:<lastUpdated>`. The
// activity's LAST_UPDATED advances every time the session progresses, so a
// CLOSED session's key is stable forever → permanent cache hit, while an
// OPEN session's key keeps advancing → the next read naturally misses and
// recomputes. Correctness falls out of the key shape; no TTL needed.
import { bitrixCall } from "@/lib/bitrix";
import type { SessionHistory } from "@/lib/bitrix";
import { parseResponseSamples, type ResponseSample, type TransferEvent } from "@/lib/bitrix-response";
import { redisGetJSON, redisSetJSON } from "@/lib/redis";

export interface SessionMetrics {
  samples: ResponseSample[];
  events: TransferEvent[];
}

const EMPTY_METRICS: SessionMetrics = { samples: [], events: [] };

function cacheKey(sessionId: string, lastUpdated: string): string {
  return `bitrix:session-metrics:${sessionId}:${lastUpdated}`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Resolve response-time metrics (raw samples + transfer events) for a set of
 * Open Lines sessions, using Redis as a read-through cache keyed per session.
 *
 * A session with a null/empty `lastUpdated` can't be keyed stably, so it is
 * always fetched live and never cached. Any session missing from the Bitrix
 * batch result (or with an empty history) resolves to `{ samples: [], events: [] }`,
 * matching the previous per-route behavior.
 */
export async function resolveSessionMetrics(
  sessions: Array<{ sessionId: string; lastUpdated: string | null }>,
): Promise<Record<string, SessionMetrics>> {
  const out: Record<string, SessionMetrics> = {};

  // Dedupe by sessionId — keep the first lastUpdated seen (same activity list,
  // so consistent across duplicates).
  const bySessionId = new Map<string, string | null>();
  for (const s of sessions) {
    if (!bySessionId.has(s.sessionId)) bySessionId.set(s.sessionId, s.lastUpdated);
  }

  const keyBySessionId = new Map<string, string>();
  const keyedIds: string[] = [];
  const missIds: string[] = [];

  for (const [sessionId, lastUpdated] of bySessionId) {
    if (lastUpdated) {
      keyBySessionId.set(sessionId, cacheKey(sessionId, lastUpdated));
      keyedIds.push(sessionId);
    } else {
      // Can't build a stable key — always live, never stored.
      missIds.push(sessionId);
    }
  }

  // Step 1 — concurrent cache reads for every keyed session.
  await Promise.all(
    keyedIds.map(async (sessionId) => {
      const key = keyBySessionId.get(sessionId) as string;
      const hit = await redisGetJSON<SessionMetrics>(key);
      if (hit) {
        out[sessionId] = hit;
      } else {
        missIds.push(sessionId);
      }
    }),
  );

  // Step 2 — batch-fetch every miss live, in chunks of 50 (Bitrix batch cap).
  const setPromises: Promise<void>[] = [];
  for (const chunk of chunkArray(missIds, 50)) {
    const cmd: Record<string, string> = {};
    for (const id of chunk) cmd[`h${id}`] = `imopenlines.session.history.get?SESSION_ID=${id}`;

    const batch = await bitrixCall("batch", { cmd, halt: 0 });
    const results = (batch.result ?? {}) as { result?: Record<string, SessionHistory> };

    for (const [key, history] of Object.entries(results.result ?? {})) {
      const sessionId = key.startsWith("h") ? key.slice(1) : key;
      if (!history?.message) continue; // filled with EMPTY_METRICS in step 3

      const metrics = parseResponseSamples(history);
      out[sessionId] = metrics;

      const cacheKeyForSession = keyBySessionId.get(sessionId);
      if (cacheKeyForSession) setPromises.push(redisSetJSON(cacheKeyForSession, metrics));
    }
  }
  await Promise.all(setPromises);

  // Step 3 — any session still absent (missing from batch result, empty
  // history, or unkeyed-and-untouched) resolves to empty metrics.
  for (const sessionId of bySessionId.keys()) {
    if (!(sessionId in out)) out[sessionId] = EMPTY_METRICS;
  }

  return out;
}
