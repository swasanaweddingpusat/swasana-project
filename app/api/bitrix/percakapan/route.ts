import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixList, bitrixCall, resolveBitrixUsers, BitrixApiError } from "@/lib/bitrix";
import type { SessionHistory } from "@/lib/bitrix";
import { parseResponseSamples, avgSeconds } from "@/lib/bitrix-response";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";

// Open Lines conversations ("Percakapan") are stored as CRM activities whose
// PROVIDER_ID marks them as chat sessions. There is no imopenlines.session.list
// REST method on an inbound webhook, so this is the reliable source.
const PROVIDER_ID = "IMOPENLINES_SESSION";

// Fields pulled per session — everything the Percakapan table renders.
const ACTIVITY_SELECT = [
  "ID",
  "OWNER_ID",
  "OWNER_TYPE_ID",
  "ASSOCIATED_ENTITY_ID",
  "ORIGIN_ID",
  "SUBJECT",
  "DIRECTION",
  "COMPLETED",
  "STATUS",
  "RESPONSIBLE_ID",
  "RESULT_SOURCE_ID",
  "PROVIDER_TYPE_ID",
  "CREATED",
  "START_TIME",
  "END_TIME",
  "LAST_UPDATED",
];

interface RawActivity {
  ID: string;
  OWNER_ID: string | null;
  OWNER_TYPE_ID: string | null;
  ASSOCIATED_ENTITY_ID: string | null;
  ORIGIN_ID: string | null;
  SUBJECT: string | null;
  DIRECTION: string | null;
  COMPLETED: string | null;
  STATUS: string | null;
  RESPONSIBLE_ID: string | null;
  RESULT_SOURCE_ID: string | null;
  PROVIDER_TYPE_ID: string | null;
  CREATED: string | null;
  START_TIME: string | null;
  END_TIME: string | null;
  LAST_UPDATED: string | null;
}

/**
 * GET /api/bitrix/percakapan?start=0&direction=1&q=text
 *
 * Returns one page (max 50) of Open Lines conversations ("Percakapan") from the
 * Contact Center, enriched server-side: the client name + phone + venue parsed
 * from the session SUBJECT, the human channel label, the responsible agent
 * (RESPONSIBLE_ID → name), the linked deal id (OWNER_ID when it's a deal), plus
 * created/closed timestamps and a computed conversation duration.
 *
 * NOTE: message count, star ratings, and response-time metrics shown in the
 * Bitrix UI are NOT part of the activity record and need Open Lines statistics
 * scope, so they are intentionally omitted here.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-percakapan:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);

  const filter: Record<string, string> = { PROVIDER_ID };

  // Direction filter — "1" inbound, "2" outbound.
  const direction = searchParams.get("direction")?.trim();
  if (direction === "1" || direction === "2") filter.DIRECTION = direction;

  // Status filter — "open" (still handled) vs "closed".
  const status = searchParams.get("status")?.trim();
  if (status === "open") filter.COMPLETED = "N";
  if (status === "closed") filter.COMPLETED = "Y";

  // Free-text search — server-side partial match on the session subject (carries
  // the client name + phone + venue + channel).
  const q = searchParams.get("q")?.trim();
  if (q) filter["%SUBJECT"] = q;

  // Sales filter — RESPONSIBLE_ID is a Bitrix user id.
  const responsibleId = searchParams.get("responsible")?.trim();
  if (responsibleId) filter.RESPONSIBLE_ID = responsibleId;

  const startRaw = Number(searchParams.get("start"));
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? startRaw : 0;

  try {
    const { items, total, next } = await bitrixList<RawActivity>("crm.activity.list", {
      select: ACTIVITY_SELECT,
      filter,
      order: { ID: "DESC" },
      start,
    });

    // Resolve responsible agents to display names in one batched call.
    const userMap = await resolveBitrixUsers(items.map((a) => a.RESPONSIBLE_ID ?? "").filter(Boolean));

    // Compute each row's average response time (assign/transfer → agent's first
    // message) from session history. Bitrix has no bulk stat for this, so walk
    // the current page's sessions in batches of 50 and derive it locally.
    const sessionIds = items
      .map((a) => a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID)
      .filter(Boolean);
    const avgResponseBySession = await resolveAvgResponseBySession(sessionIds);

    const rows = items.map((a) => {
      const parsed = parseSubject(a.SUBJECT);
      // Session id shown in Bitrix (# column) is the Open Lines session, carried
      // by ASSOCIATED_ENTITY_ID / ORIGIN_ID (IMOL_<id>). The linked CRM record is
      // OWNER_ID, but only when the owner type is a deal (2).
      const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
      const dealId = a.OWNER_TYPE_ID === "2" ? a.OWNER_ID : null;

      return {
        id: a.ID,
        sessionId,
        dealId,
        direction: a.DIRECTION === "2" ? "outbound" : "inbound",
        closed: a.COMPLETED === "Y",
        client: parsed.name,
        phone: parsed.phone,
        venue: parsed.venue,
        channel: parsed.channel ?? channelFromSourceId(a.RESULT_SOURCE_ID),
        responsibleId: a.RESPONSIBLE_ID,
        responsible: (a.RESPONSIBLE_ID && userMap[a.RESPONSIBLE_ID]) ?? null,
        createdAt: a.CREATED ?? a.START_TIME,
        closedAt: a.COMPLETED === "Y" ? a.END_TIME : null,
        lastMessageAt: a.LAST_UPDATED,
        durationSec: durationSeconds(a.START_TIME, a.END_TIME),
        avgResponseSec: avgResponseBySession[sessionId] ?? null,
      };
    });

    return Response.json({ items: rows, total, next: next ?? null });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/percakapan]", e);
    return Response.json({ error: "Gagal mengambil data percakapan." }, { status: 500 });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function stripImol(origin: string | null): string | null {
  if (!origin) return null;
  const m = origin.match(/IMOL_(\d+)/);
  return m ? m[1] : origin;
}

// Fetch session histories in chunks of 50 and return sessionId → avg response
// seconds. A missing/empty history resolves to null (rendered as "-").
async function resolveAvgResponseBySession(sessionIds: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const unique = [...new Set(sessionIds)];

  for (const chunk of chunkArray(unique, 50)) {
    const cmd: Record<string, string> = {};
    for (const id of chunk) cmd[`h${id}`] = `imopenlines.session.history.get?SESSION_ID=${id}`;

    const batch = await bitrixCall("batch", { cmd, halt: 0 });
    const results = (batch.result ?? {}) as { result?: Record<string, SessionHistory> };

    for (const [key, history] of Object.entries(results.result ?? {})) {
      const sessionId = key.startsWith("h") ? key.slice(1) : key;
      if (!history?.message) {
        out[sessionId] = null;
        continue;
      }
      const { samples } = parseResponseSamples(history);
      out[sessionId] = samples.length > 0 ? avgSeconds(samples) : null;
    }

    // Preserve null for sessions missing from the batch result (e.g. error).
    for (const id of chunk) {
      if (!(id in out)) out[id] = null;
    }
  }

  return out;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Conversation duration in seconds from START/END; null when either is missing.
function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 1000);
}
