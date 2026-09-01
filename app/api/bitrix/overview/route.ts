import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  bitrixListAll,
  getBitrixCrmMeta,
  getBitrixDealEnums,
  resolveBitrixUsers,
  labelFromSourceId,
  stripImol,
  BitrixApiError,
} from "@/lib/bitrix";
import { resolveSessionMetrics } from "@/lib/bitrix-session-metrics";
import { BITRIX_USER_NAME_OVERRIDES } from "@/lib/bitrix-accounts";

// Portal-specific custom fields (see /api/bitrix/deals for the same ids).
const UF_ADS_URL = "UF_CRM_1770698079121"; // ad source URL (fb.me / instagram post)
const UF_VENUE = "UF_CRM_1767957579717"; // enum: venue name
const UF_REASON = "UF_CRM_1774952346733"; // enum: includes "Getback"
const UF_ISSUE = "UF_CRM_1768930533046"; // enum: Leads / No Response / Spam / Komplain …
const UF_DB_DATE = "UF_CRM_1786680629702"; // date: "Tanggal Database" — when the lead entered the database

// Open Lines conversation activities — same provider Response Sales / Percakapan use.
const PROVIDER_ID = "IMOPENLINES_SESSION";

// Exported so the daily cron warmer (lib/bitrix-warm-targets.ts) can request
// the exact same default-view params — any drift here would warm a different
// Redis cache key than the one this route actually reads.
export const OVERVIEW_DEAL_SELECT = [
  "ID",
  "TITLE",
  "STAGE_ID",
  "CATEGORY_ID",
  "CONTACT_ID",
  "SOURCE_ID",
  "ASSIGNED_BY_ID",
  "DATE_CREATE",
  UF_ADS_URL,
  UF_VENUE,
  UF_REASON,
  UF_ISSUE,
  UF_DB_DATE,
];

// Venue enum values that aren't real venues — excluded from the venue breakdown
// and from the "database venue" total, matching the daily report's scope.
const NON_VENUE_LABELS = new Set(["MICE", "NON VENUE"]);

// "Database mandiri" = leads the sales sourced themselves (Live TikTok streams or
// Referral); everything else is "database kantor" (office/ads-driven channels).
// Matched on the resolved SOURCE label (exact, case-insensitive) so it tracks the
// CRM's source names rather than portal-specific status ids.
const MANDIRI_SOURCE_LABELS = new Set(["live tiktok", "referral"]);

interface RawDeal {
  ID: string;
  TITLE: string | null;
  STAGE_ID: string | null;
  CATEGORY_ID: string | null;
  CONTACT_ID: string | null;
  SOURCE_ID: string | null;
  ASSIGNED_BY_ID: string | null;
  DATE_CREATE: string | null;
  [key: string]: string | null | undefined;
}

interface Bucket {
  key: string;
  label: string;
  count: number;
}

interface AdBucket {
  key: string;
  url: string;
  count: number;
}

interface SalesBucket {
  key: string;
  label: string;
  count: number;
  getback: number;
  kantor: number;
  mandiri: number;
  responded: number;
  notResponded: number;
}

/**
 * GET /api/bitrix/overview?from=2026-08-12&to=2026-08-12
 *
 * Aggregates CRM Deals ("Transaksi") created within [from, to] into the same
 * breakdowns the daily "Perolehan Database Venue & Sales" report uses:
 *   • Sumber Database — count per channel (SOURCE_ID)
 *   • Sumber Iklan    — count per ad URL (clickable), plus an "Organik" bucket
 *   • Database Sales  — count per responsible user, with a getback annotation
 *   • Venue           — count per venue (custom enum field)
 *
 * All figures are derived live from Bitrix and reflect the raw CRM data. They
 * may differ from the manually-compiled daily report, which applies its own
 * filtering/timezone conventions. Defaults to "yesterday" when no range given.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-overview:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  const fromDay = isIsoDay(fromRaw) ? fromRaw : yesterdayFallback(toRaw);
  const toDay = isIsoDay(toRaw) ? toRaw : fromDay;

  // Extra filters (all optional): pipeline (CATEGORY_ID), stage (name), client
  // (CONTACT_ID) + sales (ASSIGNED_BY_ID) — resolved to precise ids client-side
  // via the searchable-select typeahead, so the server filters directly on the
  // deal fields instead of a post-fetch name substring match.
  const pipeline = searchParams.get("pipeline")?.trim() ?? "";
  const stageName = searchParams.get("stage")?.trim() ?? "";
  const clientId = searchParams.get("clientId")?.trim() ?? "";
  const salesId = searchParams.get("salesId")?.trim() ?? "";
  const issueName = searchParams.get("issue")?.trim() ?? "";
  const dbFrom = searchParams.get("dbFrom")?.trim() ?? "";
  const dbTo = searchParams.get("dbTo")?.trim() ?? "";

  try {
    // Meta up front so the stage name → STATUS_ID set is ready before the list
    // call is built (meta is cached, 10-min TTL).
    const [meta, enums] = await Promise.all([
      getBitrixCrmMeta(),
      getBitrixDealEnums([UF_VENUE, UF_REASON, UF_ISSUE]),
    ]);

    // Bitrix stores DATE_CREATE with a +03:00 offset; filtering on the bare date
    // string (no offset) matches "created this day" in its UI.
    const filter: Record<string, string | string[]> = {
      ">=DATE_CREATE": `${fromDay}T00:00:00`,
      "<DATE_CREATE": `${nextDay(toDay)}T00:00:00`,
    };
    if (pipeline) filter.CATEGORY_ID = pipeline;
    if (clientId) filter.CONTACT_ID = clientId;
    if (salesId) filter.ASSIGNED_BY_ID = salesId;
    if (stageName) {
      const ids = meta.stageIdsByName[stageName] ?? [];
      filter.STAGE_ID = ids.length > 0 ? ids : ["__none__"];
    }
    if (issueName) {
      // Resolve the issue label back to its enum item ID (label → ID).
      const issueEnumForFilter = enums[UF_ISSUE] ?? {};
      const issueId = Object.entries(issueEnumForFilter).find(([, label]) => label === issueName)?.[0];
      filter[UF_ISSUE] = issueId ?? "__none__";
    }
    // Tanggal Database range → UF_DB_DATE. Date-only field, so bound on the bare
    // ISO day; "to" is inclusive via <= on the same day.
    if (isIsoDay(dbFrom)) filter[`>=${UF_DB_DATE}`] = dbFrom;
    if (isIsoDay(dbTo)) filter[`<=${UF_DB_DATE}`] = dbTo;

    const { items } = await bitrixListAll<RawDeal>("crm.deal.list", {
      select: OVERVIEW_DEAL_SELECT,
      filter,
      order: { DATE_CREATE: "ASC" },
    });

    // Still needed for the Database Sales breakdown labels (ASSIGNED_BY_ID → name).
    const userMap = await resolveBitrixUsers(items.map((d) => d.ASSIGNED_BY_ID ?? "").filter(Boolean));

    const venueEnum = enums[UF_VENUE] ?? {};
    const reasonEnum = enums[UF_REASON] ?? {};
    const issueEnum = enums[UF_ISSUE] ?? {};

    // Spam/Prank — deals whose issue enum label mentions "spam" or "prank".
    let spamPrank = 0;
    for (const d of items) {
      const issueId = d[UF_ISSUE];
      const label = issueId ? issueEnum[issueId]?.toLowerCase() ?? "" : "";
      if (label.includes("spam") || label.includes("prank")) spamPrank++;
    }

    // Sumber Database — channel label (WA / IG Messenger / TikTok DM …).
    const sources: Bucket[] = bucketize(
      items,
      (d) => d.SOURCE_ID ?? "UNKNOWN",
      (key) => meta.sources[key] ?? labelFromSourceId(key),
    );

    // Database Kantor vs Mandiri — reuse the source buckets (already resolved).
    let kantor = 0;
    let mandiri = 0;
    for (const b of sources) {
      if (MANDIRI_SOURCE_LABELS.has(b.label.toLowerCase())) mandiri += b.count;
      else kantor += b.count;
    }

    // Sumber Iklan — count per ad URL. Deals without an ad URL are "Organik".
    const adCounts = new Map<string, number>();
    let organik = 0;
    for (const d of items) {
      const url = (d[UF_ADS_URL] ?? "").trim();
      if (!url) {
        organik++;
        continue;
      }
      adCounts.set(url, (adCounts.get(url) ?? 0) + 1);
    }
    const ads: AdBucket[] = [...adCounts.entries()]
      .map(([url, count]) => ({ key: url, url, count }))
      .sort((a, b) => b.count - a.count);
    const fromAds = items.length - organik;

    // Database Sales — per responsible user, with getback count.
    const salesMap = new Map<string, SalesBucket>();
    for (const d of items) {
      const key = d.ASSIGNED_BY_ID ?? "UNKNOWN";
      const label = userMap[key] ?? (key === "UNKNOWN" ? "Tidak ditetapkan" : `#${key}`);
      const bucket = salesMap.get(key) ?? {
        key,
        label,
        count: 0,
        getback: 0,
        kantor: 0,
        mandiri: 0,
        responded: 0,
        notResponded: 0,
      };
      bucket.count++;
      const reasonId = d[UF_REASON];
      if (reasonId && reasonEnum[reasonId]?.toLowerCase() === "getback") bucket.getback++;
      const srcLabel = (meta.sources[d.SOURCE_ID ?? "UNKNOWN"] ?? labelFromSourceId(d.SOURCE_ID ?? "UNKNOWN")).toLowerCase();
      if (MANDIRI_SOURCE_LABELS.has(srcLabel)) bucket.mandiri++;
      else bucket.kantor++;
      salesMap.set(key, bucket);
    }
    const sales = [...salesMap.values()].sort((a, b) => b.count - a.count);

    // Venue — from the custom enum field; skip empty + non-venue placeholders.
    const venueMap = new Map<string, number>();
    let withVenue = 0;
    for (const d of items) {
      const venueId = d[UF_VENUE];
      const label = venueId ? venueEnum[venueId] : undefined;
      if (!label || NON_VENUE_LABELS.has(label)) continue;
      venueMap.set(label, (venueMap.get(label) ?? 0) + 1);
      withVenue++;
    }
    const venues: Bucket[] = [...venueMap.entries()]
      .map(([label, count]) => ({ key: label, label, count }))
      .sort((a, b) => b.count - a.count);

    // Response Status — sudah dibalas vs belum dibalas, computed over the exact
    // filtered deal set above (same Open Lines session metrics Response Sales /
    // Percakapan use, keyed by each deal's linked conversation activity). Also
    // broken down per responsible sales (ASSIGNED_BY_ID) for the follow-up
    // backlog list on the general overview landing page — derived from the SAME
    // sessions/metrics so the per-sales sum always matches the aggregate.
    const dealIds = items.map((d) => d.ID);
    const assignedByDeal = new Map(items.map((d) => [d.ID, d.ASSIGNED_BY_ID ?? "UNKNOWN"]));
    let responded = 0;
    let notResponded = 0;
    const responseBySalesMap = new Map<string, { responded: number; notResponded: number }>();
    if (dealIds.length > 0) {
      const { items: acts } = await bitrixListAll<{
        ID: string;
        OWNER_ID: string | null;
        ASSOCIATED_ENTITY_ID: string | null;
        ORIGIN_ID: string | null;
        LAST_UPDATED: string | null;
      }>("crm.activity.list", {
        select: ["ID", "OWNER_ID", "ASSOCIATED_ENTITY_ID", "ORIGIN_ID", "LAST_UPDATED"],
        filter: { PROVIDER_ID, OWNER_TYPE_ID: "2", OWNER_ID: dealIds },
        order: { ID: "DESC" },
      });

      const sessionsBySessionId = new Map<
        string,
        { sessionId: string; lastUpdated: string | null; dealId: string | null }
      >();
      for (const a of acts) {
        const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
        if (!sessionsBySessionId.has(sessionId)) {
          sessionsBySessionId.set(sessionId, { sessionId, lastUpdated: a.LAST_UPDATED, dealId: a.OWNER_ID });
        }
      }

      const metrics = await resolveSessionMetrics(
        [...sessionsBySessionId.values()].map(({ sessionId, lastUpdated }) => ({ sessionId, lastUpdated })),
      );
      for (const { sessionId, dealId } of sessionsBySessionId.values()) {
        const isPending = metrics[sessionId]?.hasPending === true;
        if (isPending) notResponded++;
        else responded++;

        const userId = (dealId ? assignedByDeal.get(dealId) : undefined) ?? "UNKNOWN";
        const bucket = responseBySalesMap.get(userId) ?? { responded: 0, notResponded: 0 };
        if (isPending) bucket.notResponded++;
        else bucket.responded++;
        responseBySalesMap.set(userId, bucket);

        const salesBucket = salesMap.get(userId);
        if (salesBucket) {
          if (isPending) salesBucket.notResponded++;
          else salesBucket.responded++;
        }
      }
    }

    const responseBySales = [...responseBySalesMap.entries()]
      .map(([userId, counts]) => ({
        userId,
        name:
          userId === "UNKNOWN"
            ? "Tidak ditetapkan"
            : BITRIX_USER_NAME_OVERRIDES[userId] ?? userMap[userId] ?? `#${userId}`,
        responded: counts.responded,
        notResponded: counts.notResponded,
      }))
      .sort((a, b) => b.notResponded - a.notResponded);

    return Response.json({
      range: { from: fromDay, to: toDay },
      total: items.length,
      kantor,
      mandiri,
      withVenue,
      organik,
      fromAds,
      spamPrank,
      sources,
      ads,
      sales,
      venues,
      responseStatus: { responded, notResponded },
      responseBySales,
      // Ordered stage funnel — powers the "Tahap" filter dropdown on the client.
      stageCatalog: meta.stageCatalog,
      // Distinct issue labels — powers the "Issue" filter dropdown on the client.
      issueCatalog: Object.values(issueEnum),
    });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/overview]", e);
    return Response.json({ error: "Gagal mengambil ringkasan CRM." }, { status: 500 });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isIsoDay(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// Day after an ISO day via UTC calendar math — avoids timezone drift for a
// date-only boundary.
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function yesterdayFallback(to: string | null): string {
  if (isIsoDay(to)) return to;
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function bucketize<T>(rows: T[], keyOf: (row: T) => string, labelOf: (key: string) => string): Bucket[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: labelOf(key), count }))
    .sort((a, b) => b.count - a.count);
}
