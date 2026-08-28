import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  bitrixListAll,
  resolveBitrixUsers,
  stripImol,
  BitrixApiError,
} from "@/lib/bitrix";
import { avgSeconds, type ResponseSample } from "@/lib/bitrix-response";
import { resolveSessionMetrics } from "@/lib/bitrix-session-metrics";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";
import { BITRIX_USER_NAME_OVERRIDES } from "@/lib/bitrix-accounts";

const PROVIDER_ID = "IMOPENLINES_SESSION";

// "Tanggal Database" — a date-only custom field on the DEAL (when the lead
// entered the database). Response Sales works on Open Lines activities, so this
// filter is resolved via each activity's linked deal (OWNER_ID / OWNER_TYPE_ID).
const UF_DB_DATE = "UF_CRM_1786680629702";

const ACTIVITY_SELECT = [
  "ID",
  "OWNER_ID",
  "OWNER_TYPE_ID",
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
  "LAST_UPDATED",
];

interface RawActivity {
  ID: string;
  OWNER_ID: string | null;
  OWNER_TYPE_ID: string | null;
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
  LAST_UPDATED: string | null;
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
 *   &dbFrom=2026-08-01&dbTo=2026-08-13
 *
 * Aggregates the average sales response time across Open Lines conversations
 * created within [from, to]. The optional dbFrom/dbTo range narrows to sessions
 * whose linked deal has a "Tanggal Database" (UF_DB_DATE) in that window — see
 * `filterByDbDate`. Response time is measured per customer message:
 * from the earliest unanswered customer message to the next agent reply. An
 * agent follow-up with no new customer message pending produces no sample
 * (see `parseResponseSamples` in lib/bitrix-response.ts).
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
  const dbFrom = searchParams.get("dbFrom")?.trim() ?? "";
  const dbTo = searchParams.get("dbTo")?.trim() ?? "";

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

    // Optional "Tanggal Database" filter — the field lives on the linked DEAL,
    // not the activity. Keep only activities whose deal's UF_DB_DATE is in range
    // (activities not linked to a deal are dropped while the filter is active).
    const activities = await filterByDbDate(items, dbFrom, dbTo);

    const userMap = await resolveBitrixUsers(activities.map((a) => a.RESPONSIBLE_ID ?? "").filter(Boolean));

    // sessionId → display metadata for the conversation list.
    const activityBySession = new Map<string, RawActivity>();
    for (const a of activities) {
      const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
      if (sessionId) activityBySession.set(sessionId, a);
    }

    // Accumulate samples per (userId → samples) and per (sessionId → userId → samples).
    const samplesByUser = new Map<string, ResponseSample[]>();
    const sessionSamples = new Map<string, Map<string, ResponseSample[]>>();

    const sessions = [...activityBySession.entries()].map(([sessionId, a]) => ({
      sessionId,
      lastUpdated: a.LAST_UPDATED,
    }));
    const sessionMetrics = await resolveSessionMetrics(sessions);

    for (const [sessionId, metrics] of Object.entries(sessionMetrics)) {
      const { samples } = metrics;
      if (samples.length === 0) continue;

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
          name: BITRIX_USER_NAME_OVERRIDES[userId] ?? userMap[userId] ?? `#${userId}`,
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
      totalSessions: activities.length,
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

/**
 * Narrow a set of Open Lines activities to those whose linked deal has a
 * "Tanggal Database" (UF_DB_DATE) inside [dbFrom, dbTo]. Returns the input
 * unchanged when neither bound is a valid ISO day. An activity is linked to a
 * deal only when OWNER_TYPE_ID is "2"; the deal id is then OWNER_ID.
 */
async function filterByDbDate(
  items: RawActivity[],
  dbFrom: string,
  dbTo: string,
): Promise<RawActivity[]> {
  if (!isIsoDay(dbFrom) && !isIsoDay(dbTo)) return items;

  const dealIds = [
    ...new Set(
      items.filter((a) => a.OWNER_TYPE_ID === "2" && a.OWNER_ID).map((a) => a.OWNER_ID as string),
    ),
  ];
  if (dealIds.length === 0) return [];

  const dealFilter: Record<string, unknown> = { ID: dealIds };
  if (isIsoDay(dbFrom)) dealFilter[`>=${UF_DB_DATE}`] = dbFrom;
  if (isIsoDay(dbTo)) dealFilter[`<=${UF_DB_DATE}`] = dbTo;

  const { items: deals } = await bitrixListAll<{ ID: string }>("crm.deal.list", {
    select: ["ID"],
    filter: dealFilter,
    order: { ID: "ASC" },
  });
  const matched = new Set(deals.map((d) => String(d.ID)));

  return items.filter((a) => a.OWNER_TYPE_ID === "2" && a.OWNER_ID !== null && matched.has(a.OWNER_ID));
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

function formatHours(totalSeconds: number): string {
  if (!totalSeconds) return "0:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
