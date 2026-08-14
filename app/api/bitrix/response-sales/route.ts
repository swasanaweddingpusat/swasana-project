import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  bitrixCall,
  bitrixListAll,
  resolveBitrixUsers,
  stripImol,
  BitrixApiError,
} from "@/lib/bitrix";
import type { SessionHistory } from "@/lib/bitrix";
import { parseResponseSamples, avgSeconds, type ResponseSample } from "@/lib/bitrix-response";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";

const PROVIDER_ID = "IMOPENLINES_SESSION";

const ACTIVITY_SELECT = [
  "ID",
  "ASSOCIATED_ENTITY_ID",
  "ORIGIN_ID",
  "RESPONSIBLE_ID",
  "SUBJECT",
  "DIRECTION",
  "RESULT_SOURCE_ID",
  "CREATED",
  "START_TIME",
  "END_TIME",
  "COMPLETED",
];

interface RawActivity {
  ID: string;
  ASSOCIATED_ENTITY_ID: string | null;
  ORIGIN_ID: string | null;
  RESPONSIBLE_ID: string | null;
  SUBJECT: string | null;
  DIRECTION: string | null;
  RESULT_SOURCE_ID: string | null;
  CREATED: string | null;
  START_TIME: string | null;
  END_TIME: string | null;
  COMPLETED: string | null;
}

interface ConversationItem {
  sessionId: string;
  client: string;
  channel: string;
  avgResponseSec: number | null;
}

interface ResponseSalesRow {
  userId: string;
  name: string;
  samples: number;
  avgSeconds: number;
  seconds: number;
  minutes: number;
  hours: string;
  conversations: ConversationItem[];
}

/**
 * GET /api/bitrix/response-sales?from=2026-08-13&to=2026-08-13&sales=tiara
 *
 * Aggregates the average sales response time across Open Lines conversations
 * created within [from, to]. Response time is measured per assignment/transfer:
 * from the system event that assigns a session to a specific agent until that
 * agent's first message afterwards.
 *
 * Bitrix exposes no bulk response-time statistic, so this walks each session's
 * `imopenlines.session.history.get` (batched 50 at a time) and computes the
 * metric locally. Each row also carries the list of conversations the sales
 * handled, so the client can open a per-sales drawer and drill into any session.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-response-sales:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const from = isIsoDay(searchParams.get("from")) ? (searchParams.get("from") as string) : yesterday();
  const to = isIsoDay(searchParams.get("to")) ? (searchParams.get("to") as string) : from;
  const salesQuery = searchParams.get("sales")?.trim().toLowerCase() ?? "";

  try {
    const filter: Record<string, string> = {
      PROVIDER_ID,
      ">=CREATED": `${from}T00:00:00`,
      "<CREATED": `${nextDay(to)}T00:00:00`,
    };

    const { items } = await bitrixListAll<RawActivity>("crm.activity.list", {
      select: ACTIVITY_SELECT,
      filter,
      order: { CREATED: "ASC" },
    });

    const userMap = await resolveBitrixUsers(items.map((a) => a.RESPONSIBLE_ID ?? "").filter(Boolean));

    // sessionId → display metadata for the conversation list.
    const activityBySession = new Map<string, RawActivity>();
    for (const a of items) {
      const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
      if (sessionId) activityBySession.set(sessionId, a);
    }

    // Accumulate samples per (userId → samples) and per (sessionId → userId → samples).
    const samplesByUser = new Map<string, ResponseSample[]>();
    const sessionSamples = new Map<string, Map<string, ResponseSample[]>>();

    for (const chunk of chunkArray([...activityBySession.keys()], 50)) {
      const cmd: Record<string, string> = {};
      for (const id of chunk) cmd[`h${id}`] = `imopenlines.session.history.get?SESSION_ID=${id}`;

      const batch = await bitrixCall("batch", { cmd, halt: 0 });
      const results = (batch.result ?? {}) as { result?: Record<string, SessionHistory> };

      for (const [key, history] of Object.entries(results.result ?? {})) {
        const sessionId = key.startsWith("h") ? key.slice(1) : key;
        if (!history?.message) continue;

        const { samples } = parseResponseSamples(history);
        const byUser = sessionSamples.get(sessionId) ?? new Map<string, ResponseSample[]>();

        for (const s of samples) {
          const all = samplesByUser.get(s.userId) ?? [];
          all.push(s);
          samplesByUser.set(s.userId, all);

          const perSession = byUser.get(s.userId) ?? [];
          perSession.push(s);
          byUser.set(s.userId, perSession);
        }

        if (byUser.size > 0) sessionSamples.set(sessionId, byUser);
      }
    }

    const rows: ResponseSalesRow[] = [...samplesByUser.entries()]
      .map(([userId, samples]) => {
        const avg = avgSeconds(samples);
        const conversations: ConversationItem[] = [];

        for (const [sessionId, byUser] of sessionSamples) {
          const list = byUser.get(userId);
          if (!list || list.length === 0) continue;
          const a = activityBySession.get(sessionId);
          if (!a) continue;

          const parsed = parseSubject(a.SUBJECT);
          conversations.push({
            sessionId,
            client: parsed.name,
            channel: parsed.channel ?? channelFromSourceId(a.RESULT_SOURCE_ID),
            avgResponseSec: avgSeconds(list),
          });
        }

        conversations.sort((x, y) => (y.avgResponseSec ?? 0) - (x.avgResponseSec ?? 0));

        return {
          userId,
          name: userMap[userId] ?? `#${userId}`,
          samples: samples.length,
          avgSeconds: avg,
          seconds: avg,
          minutes: Math.round(avg / 60),
          hours: formatHours(avg),
          conversations,
        };
      })
      .filter((r) => !salesQuery || r.name.toLowerCase().includes(salesQuery))
      .sort((a, b) => b.avgSeconds - a.avgSeconds);

    const allSamples = [...samplesByUser.values()].flat();
    const grandSeconds = avgSeconds(allSamples);
    const grand = {
      seconds: grandSeconds,
      minutes: Math.round(grandSeconds / 60),
      hours: formatHours(grandSeconds),
      samples: allSamples.length,
    };

    return Response.json({
      from,
      to,
      totalSessions: items.length,
      rows,
      grandTotal: grand,
    });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/response-sales]", e);
    return Response.json({ error: "Gagal menghitung response sales." }, { status: 500 });
  }
}

function isIsoDay(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatHours(totalSeconds: number): string {
  if (!totalSeconds) return "0:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
