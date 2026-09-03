import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixList, bitrixListAll, searchBitrixUsers, resolveBitrixUsers, BitrixApiError } from "@/lib/bitrix";
import { avgSeconds } from "@/lib/bitrix-response";
import { resolveSessionMetrics } from "@/lib/bitrix-session-metrics";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";

// Open Lines conversations ("Percakapan") are stored as CRM activities whose
// PROVIDER_ID marks them as chat sessions. There is no imopenlines.session.list
// REST method on an inbound webhook, so this is the reliable source.
//
// Both consts below are exported so the daily cron warmer
// (lib/bitrix-warm-targets.ts) can request the exact same default-view params
// — any drift here would warm a different Redis cache key than the one this
// route actually reads.
export const PROVIDER_ID = "IMOPENLINES_SESSION";

// Bitrix caps a single `crm.activity.list` page at 50 rows — also the page
// size the "q" union path slices its merged, sorted result set into.
const PAGE_SIZE = 50;

// Fields pulled per session — everything the Percakapan table renders.
export const ACTIVITY_SELECT = [
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

  // Base filter — everything EXCEPT "%SUBJECT" and RESPONSIBLE_ID, so it can be
  // reused as-is for both the subject-match and responsible-match legs of the
  // "q" union below. The `responsible` param is legacy (the drawer no longer
  // sends it) but stays supported if some caller still passes it.
  const base: Record<string, unknown> = { PROVIDER_ID };

  // Direction filter — "1" inbound, "2" outbound.
  const direction = searchParams.get("direction")?.trim();
  if (direction === "1" || direction === "2") base.DIRECTION = direction;

  // Status filter — "open" (still handled) vs "closed".
  const status = searchParams.get("status")?.trim();
  if (status === "open") base.COMPLETED = "N";
  if (status === "closed") base.COMPLETED = "Y";

  // Legacy sales filter — RESPONSIBLE_ID is a Bitrix user id. Superseded by the
  // "q" union below (client OR sales), kept tolerant in case a caller still
  // passes it explicitly.
  const responsibleId = searchParams.get("responsible")?.trim();
  if (responsibleId) base.RESPONSIBLE_ID = responsibleId;

  // Tanggal Dibuat range — CREATED datetime (+03:00 in Bitrix), filtered on bare date.
  const createdFrom = searchParams.get("createdFrom")?.trim();
  const createdTo = searchParams.get("createdTo")?.trim();
  if (isIsoDay(createdFrom)) base[">=CREATED"] = `${createdFrom}T00:00:00`;
  if (isIsoDay(createdTo)) base["<CREATED"] = `${nextDay(createdTo)}T00:00:00`;

  // Free-text search — matches EITHER the session subject (client name/phone/
  // venue) OR the responsible sales agent's name. Bitrix filters are flat AND
  // only (no OR), so a match on "q" runs two queries and merges them below.
  const q = searchParams.get("q")?.trim();

  // "Sudah ditransfer" filter — applied post-fetch (the info lives in the session
  // history, not on the activity row). "yes" → only sessions with ≥1 transfer,
  // "no" → only sessions never transferred.
  const transferred = searchParams.get("transferred")?.trim();

  // "Sudah/Belum Dibalas" filter — applied post-fetch, same reason as above.
  // Derived from the session's `hasPending` flag: "yes" (Sudah Dibalas) → the
  // anchor was consumed (or never opened); "no" (Belum Dibalas) → the last
  // customer message / handoff is still unanswered.
  const responded = searchParams.get("responded")?.trim();

  const startRaw = Number(searchParams.get("start"));
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? startRaw : 0;

  try {
    let items: RawActivity[];
    let total: number;
    let next: number | undefined;

    if (q) {
      // Client OR sales: one query on SUBJECT, one on RESPONSIBLE_ID (only when
      // "q" resolves to at least one Bitrix user), merged + deduped by ID.
      const salesIds = (await searchBitrixUsers(q)).map((u) => u.id);

      const subjectMatches = await bitrixListAll<RawActivity>("crm.activity.list", {
        select: ACTIVITY_SELECT,
        filter: { ...base, "%SUBJECT": q },
        order: { ID: "DESC" },
      });

      const responsibleMatches =
        salesIds.length > 0
          ? await bitrixListAll<RawActivity>("crm.activity.list", {
              select: ACTIVITY_SELECT,
              filter: { ...base, RESPONSIBLE_ID: salesIds },
              order: { ID: "DESC" },
            })
          : { items: [] as RawActivity[] };

      const merged = new Map<string, RawActivity>();
      for (const a of subjectMatches.items) merged.set(a.ID, a);
      for (const a of responsibleMatches.items) merged.set(a.ID, a);
      const mergedSorted = [...merged.values()].sort((a, b) => Number(b.ID) - Number(a.ID));

      total = mergedSorted.length;
      items = mergedSorted.slice(start, start + PAGE_SIZE);
      next = start + PAGE_SIZE < total ? start + PAGE_SIZE : undefined;
    } else {
      const res = await bitrixList<RawActivity>("crm.activity.list", {
        select: ACTIVITY_SELECT,
        filter: base,
        order: { ID: "DESC" },
        start,
      });
      items = res.items;
      total = res.total;
      next = res.next;
    }

    // Resolve responsible agents to display names in one batched call.
    const userMap = await resolveBitrixUsers(items.map((a) => a.RESPONSIBLE_ID ?? "").filter(Boolean));

    // Compute each row's average response time (assign/transfer → agent's first
    // message) from session history. Bitrix has no bulk stat for this — the
    // shared helper walks each session's history (batched 50 at a time),
    // read-through cached per session in Redis.
    const sessions = items.map((a) => ({
      sessionId: a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID,
      lastUpdated: a.LAST_UPDATED,
    }));
    const sessionMetrics = await resolveSessionMetrics(sessions);

    const rows = items
      .map((a) => {
        const parsed = parseSubject(a.SUBJECT);
        // Session id shown in Bitrix (# column) is the Open Lines session, carried
        // by ASSOCIATED_ENTITY_ID / ORIGIN_ID (IMOL_<id>). The linked CRM record is
        // OWNER_ID, but only when the owner type is a deal (2).
        const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
        const dealId = a.OWNER_TYPE_ID === "2" ? a.OWNER_ID : null;
        const m = sessionMetrics[sessionId] ?? { samples: [], events: [], hasPending: false };

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
          avgResponseSec: m.samples.length > 0 ? avgSeconds(m.samples) : null,
          transferCount: m.events.length,
          transferred: m.events.length > 0,
          // "Sudah Dibalas" unless the session still has an open anchor
          // (unanswered customer message / handoff) at the end of its history.
          responded: !m.hasPending,
        };
      })
      .filter((r) => {
        if (transferred === "yes" && !r.transferred) return false;
        if (transferred === "no" && r.transferred) return false;
        if (responded === "yes" && !r.responded) return false;
        if (responded === "no" && r.responded) return false;
        return true;
      });

    // Re-count the total after a post-fetch filter (transferred/responded) is applied.
    const totalAfter =
      transferred === "yes" || transferred === "no" || responded === "yes" || responded === "no"
        ? rows.length
        : total;

    return Response.json({ items: rows, total: totalAfter, next: next ?? null });
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

function isIsoDay(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function stripImol(origin: string | null): string | null {
  if (!origin) return null;
  const m = origin.match(/IMOL_(\d+)/);
  return m ? m[1] : origin;
}

// Conversation duration in seconds from START/END; null when either is missing.
function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 1000);
}
