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
  status: "Belum Dibalas" | "Sudah Dibalas";
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
 * created within [from, to]. When dbFrom/dbTo is set, the fetch instead drives
 * from DEALS whose "Tanggal Database" (UF_DB_DATE) is in that window and loads
 * the Open Lines sessions those deals own (the CREATED range is ignored) — see
 * `dealIdsByDbDate` / `sessionsOwnedByDeals`. The database date is typically a
 * few days AFTER the chat was created, so a CREATED-range fetch would miss those
 * sessions entirely. Response time is measured per customer message:
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
    // Two fetch modes:
    //  • Tanggal Database active → drive from DEALS. The "database date" is
    //    typically a few days AFTER the chat was created, so a CREATED-range fetch
    //    would miss those sessions entirely. Resolve deals whose UF_DB_DATE is in
    //    [dbFrom, dbTo], then load the Open Lines sessions those deals own. The
    //    CREATED range is intentionally ignored in this mode — the database date
    //    is the intended filter.
    //  • Otherwise → the default CREATED-range fetch.
    const dbActive = isIsoDay(dbFrom) || isIsoDay(dbTo);

    let activities: RawActivity[];
    if (dbActive) {
      const dealIds = await dealIdsByDbDate(dbFrom, dbTo);
      activities = dealIds.length > 0 ? await sessionsOwnedByDeals(dealIds) : [];
    } else {
      const { items } = await bitrixListAll<RawActivity>("crm.activity.list", {
        select: ACTIVITY_SELECT,
        filter: {
          PROVIDER_ID,
          ">=CREATED": `${from}T00:00:00`,
          "<CREATED": `${nextDay(to)}T00:00:00`,
        },
        order: { CREATED: "ASC" },
      });
      activities = items;
    }

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

    // Track which sessions have pending (unreplied) customer messages and
    // which users were transferred to per session — needed for "Belum Dibalas".
    const sessionHasPending = new Map<string, boolean>();
    const sessionTransferTargets = new Map<string, Set<string>>();

    for (const [sessionId, metrics] of Object.entries(sessionMetrics)) {
      const { samples, events, hasPending } = metrics;

      sessionHasPending.set(sessionId, hasPending);

      // Collect transfer targets for this session.
      const targets = new Set<string>();
      for (const e of events) targets.add(e.toUserId);
      if (targets.size > 0) sessionTransferTargets.set(sessionId, targets);

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

    // Build unreplied conversation entries: agents transferred to but with no
    // samples in that session. These surface as "Belum Dibalas" rows.
    const unrepliedConversations = new Map<string, Set<string>>();
    for (const [sessionId, targets] of sessionTransferTargets) {
      const replied = sessionSamples.get(sessionId);
      for (const userId of targets) {
        if (replied?.has(userId)) continue;
        const set = unrepliedConversations.get(userId) ?? new Set<string>();
        set.add(sessionId);
        unrepliedConversations.set(userId, set);
        // Ensure the user appears in samplesByUser (with empty array) so they
        // get a row in the main table even with zero samples.
        if (!samplesByUser.has(userId)) samplesByUser.set(userId, []);
      }
    }

    // Resolve names for sample user IDs not already covered by activity
    // RESPONSIBLE_IDs (agents who appear only via transfer, not as the final
    // responsible party, would otherwise show as "#XX").
    const missingSampleIds = [...samplesByUser.keys()].filter((id) => !userMap[id]);
    if (missingSampleIds.length > 0) {
      const extra = await resolveBitrixUsers(missingSampleIds);
      Object.assign(userMap, extra);
    }

    const rows: ResponseSalesRow[] = [...samplesByUser.entries()]
      .map(([userId, samples]) => {
        const avg = avgSeconds(samples);
        const conversations: ConversationItem[] = [];

        // Replied conversations.
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
            status: "Sudah Dibalas",
          });
        }

        // Unreplied conversations (transferred to this user but no reply yet).
        const unreplied = unrepliedConversations.get(userId);
        if (unreplied) {
          for (const sessionId of unreplied) {
            const a = activityBySession.get(sessionId);
            if (!a) continue;
            const parsed = parseSubject(a.SUBJECT);
            conversations.push({
              sessionId,
              client: parsed.name,
              channel: parsed.channel ?? channelFromSourceId(a.RESULT_SOURCE_ID),
              avgResponseSec: null,
              status: a.COMPLETED === "Y" ? "Sudah Dibalas" : "Belum Dibalas",
            });
          }
        }

        conversations.sort((x, y) => {
          if (x.status !== y.status) return x.status === "Belum Dibalas" ? -1 : 1;
          return (y.avgResponseSec ?? 0) - (x.avgResponseSec ?? 0);
        });

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
 * Resolve the deal ids whose "Tanggal Database" (UF_DB_DATE) falls inside
 * [dbFrom, dbTo]. The "to" bound is inclusive (bare ISO day, matching the
 * Overview/deals filter). At least one bound must be a valid ISO day — callers
 * only invoke this when `dbActive` is true.
 */
async function dealIdsByDbDate(dbFrom: string, dbTo: string): Promise<string[]> {
  const filter: Record<string, unknown> = {};
  if (isIsoDay(dbFrom)) filter[`>=${UF_DB_DATE}`] = dbFrom;
  if (isIsoDay(dbTo)) filter[`<=${UF_DB_DATE}`] = dbTo;

  const { items } = await bitrixListAll<{ ID: string }>("crm.deal.list", {
    select: ["ID"],
    filter,
    order: { ID: "ASC" },
  });
  return [...new Set(items.map((d) => String(d.ID)))];
}

/**
 * Load the Open Lines sessions (activities) owned by the given deals. An
 * activity belongs to a deal when OWNER_TYPE_ID is "2" and OWNER_ID is the deal
 * id. Deal ids are chunked (100 per request) to keep the filter payload sane.
 */
async function sessionsOwnedByDeals(dealIds: string[]): Promise<RawActivity[]> {
  const out: RawActivity[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < dealIds.length; i += 100) {
    const slice = dealIds.slice(i, i + 100);
    const { items } = await bitrixListAll<RawActivity>("crm.activity.list", {
      select: ACTIVITY_SELECT,
      filter: { PROVIDER_ID, OWNER_TYPE_ID: "2", OWNER_ID: slice },
      order: { CREATED: "ASC" },
    });
    for (const a of items) {
      if (!seen.has(a.ID)) {
        seen.add(a.ID);
        out.push(a);
      }
    }
  }

  return out;
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
