import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixListAll, getBitrixCrmMeta, getBitrixDealEnums, resolveBitrixUsers, BitrixApiError } from "@/lib/bitrix";

// Portal-specific custom fields (see /api/bitrix/deals for the same ids).
const UF_ADS_URL = "UF_CRM_1770698079121"; // ad source URL (fb.me / instagram post)
const UF_VENUE = "UF_CRM_1767957579717"; // enum: venue name
const UF_REASON = "UF_CRM_1774952346733"; // enum: includes "Getback"
const UF_ISSUE = "UF_CRM_1768930533046"; // enum: Leads / No Response / Spam / Komplain …

const DEAL_SELECT = ["ID", "TITLE", "SOURCE_ID", "ASSIGNED_BY_ID", "DATE_CREATE", UF_ADS_URL, UF_VENUE, UF_REASON, UF_ISSUE];

// Venue enum values that aren't real venues — excluded from the venue breakdown
// and from the "database venue" total, matching the daily report's scope.
const NON_VENUE_LABELS = new Set(["MICE", "NON VENUE"]);

interface RawDeal {
  ID: string;
  TITLE: string | null;
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
  const { session, response } = await requirePermissionForRoute({ module: "customers", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-overview:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  const fromDay = isIsoDay(fromRaw) ? fromRaw : yesterdayFallback(toRaw);
  const toDay = isIsoDay(toRaw) ? toRaw : fromDay;

  // Bitrix stores DATE_CREATE with a +03:00 offset; filtering on the bare date
  // string (no offset) matches "created this day" in its UI.
  const filter = {
    ">=DATE_CREATE": `${fromDay}T00:00:00`,
    "<DATE_CREATE": `${nextDay(toDay)}T00:00:00`,
  };

  try {
    const [{ items }, meta, enums] = await Promise.all([
      bitrixListAll<RawDeal>("crm.deal.list", { select: DEAL_SELECT, filter, order: { DATE_CREATE: "ASC" } }),
      getBitrixCrmMeta(),
      getBitrixDealEnums([UF_VENUE, UF_REASON, UF_ISSUE]),
    ]);

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
    const sources = bucketize(
      items,
      (d) => d.SOURCE_ID ?? "UNKNOWN",
      (key) => meta.sources[key] ?? labelFromSourceId(key),
    );

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
      const bucket = salesMap.get(key) ?? { key, label, count: 0, getback: 0 };
      bucket.count++;
      const reasonId = d[UF_REASON];
      if (reasonId && reasonEnum[reasonId]?.toLowerCase() === "getback") bucket.getback++;
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

    return Response.json({
      range: { from: fromDay, to: toDay },
      total: items.length,
      withVenue,
      organik,
      fromAds,
      spamPrank,
      sources,
      ads,
      sales,
      venues,
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

// Fallback label when a SOURCE_ID isn't in the resolved status map.
function labelFromSourceId(source: string): string {
  if (source === "UNKNOWN") return "Tidak diketahui";
  const raw = source.split("|").pop() ?? source;
  if (/tiktok/i.test(raw)) return "TikTok";
  if (/instagram|ig_|fbinstagram/i.test(raw)) return "Instagram";
  if (/whatsapp|_wa_|wazzup/i.test(raw)) return "WhatsApp";
  if (/facebook|fb_/i.test(raw)) return "Facebook";
  return raw.replace(/ASKARASOFT_CONN_/i, "").replace(/_/g, " ");
}
