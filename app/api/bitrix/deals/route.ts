import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  bitrixList,
  getBitrixCrmMeta,
  getBitrixDealEnums,
  resolveBitrixContactInfo,
  resolveBitrixUsers,
  BitrixApiError,
} from "@/lib/bitrix";

// Custom (UF_CRM_*) fields carrying the ad-tracking + issue data. These ids are
// specific to this Bitrix portal — discovered from crm.deal.fields.
const UF_ISSUE = "UF_CRM_1768930533046"; // enum: Leads / No Response / Spam / Komplain …
const UF_ADS_URL = "UF_CRM_1770698079121"; // ad source URL (IG/FB post link)
const UF_ADS_HEADLINE = "UF_CRM_1770698102639"; // ad headline
const UF_ADS_BODY = "UF_CRM_1770698208232"; // ad body / caption
const UF_DB_DATE = "UF_CRM_1786680629702"; // date: "Tanggal Database" — when the lead entered the database

// Fields pulled for the Transaksi (deals) table.
const DEAL_SELECT = [
  "ID",
  "TITLE",
  "STAGE_ID",
  "CATEGORY_ID",
  "CONTACT_ID",
  "OPPORTUNITY",
  "CURRENCY_ID",
  "SOURCE_ID",
  "SOURCE_DESCRIPTION",
  "ASSIGNED_BY_ID",
  "DATE_CREATE",
  UF_ISSUE,
  UF_ADS_URL,
  UF_ADS_HEADLINE,
  UF_ADS_BODY,
  UF_DB_DATE,
];

interface RawDeal {
  ID: string;
  TITLE: string | null;
  STAGE_ID: string | null;
  CATEGORY_ID: string | null;
  CONTACT_ID: string | null;
  OPPORTUNITY: string | null;
  CURRENCY_ID: string | null;
  SOURCE_ID: string | null;
  SOURCE_DESCRIPTION: string | null;
  ASSIGNED_BY_ID: string | null;
  DATE_CREATE: string | null;
  // UF_CRM_* custom fields — accessed via bracket notation with the const keys.
  [key: string]: string | null | undefined;
}

/**
 * GET /api/bitrix/deals?start=0&filter[CATEGORY_ID]=5&order[DATE_CREATE]=DESC
 *
 * Returns one page (max 50) of deals ("Transaksi"), enriched server-side with
 * readable names: pipeline/stage/source from CRM metadata, the client name +
 * phone from CONTACT_ID, the responsible user (PIC) from ASSIGNED_BY_ID, and the
 * issue label from its enumeration field. Ad-tracking fields (url/headline/body)
 * are passed through as-is.
 *
 * PIC resolution needs the `user` scope on the webhook; it degrades gracefully
 * to the raw id if that scope is missing.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-deals:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);

  const filter: Record<string, string> = {};
  const order: Record<string, "ASC" | "DESC"> = {};
  for (const [key, value] of searchParams.entries()) {
    const f = key.match(/^filter\[(.+)\]$/);
    if (f) {
      filter[f[1]] = value;
      continue;
    }
    const o = key.match(/^order\[(.+)\]$/);
    if (o) order[o[1]] = value.toUpperCase() === "ASC" ? "ASC" : "DESC";
  }
  if (Object.keys(order).length === 0) order.DATE_CREATE = "DESC";

  // Free-text search — server-side partial match on the deal title. Client name
  // isn't a deal field (it's a CONTACT_ID relation), so it can't be searched
  // here without a second heavy lookup; title covers the common case.
  const q = searchParams.get("q")?.trim();
  if (q) filter["%TITLE"] = q;

  // Stage filter — the client sends a stage *name* ("Hot Prospek") because the
  // same stage carries a different STATUS_ID per pipeline. Resolve it to every
  // matching STATUS_ID via the CRM meta and filter STAGE_ID by that set.
  const stageName = searchParams.get("stage")?.trim();

  // Issue filter — the client sends an issue *label* ("Spam/Prank"); resolve it
  // to the enum item ID and filter UF_ISSUE by it.
  const issueName = searchParams.get("issue")?.trim();

  // Date-range filters (ISO day strings, all optional). Two independent ranges:
  //   created* → DATE_CREATE (datetime; +03:00 in Bitrix, filtered on bare date)
  //   db*      → UF_DB_DATE  ("Tanggal Database", a date-only custom field)
  const createdFrom = searchParams.get("createdFrom")?.trim();
  const createdTo = searchParams.get("createdTo")?.trim();
  const dbFrom = searchParams.get("dbFrom")?.trim();
  const dbTo = searchParams.get("dbTo")?.trim();

  const startRaw = Number(searchParams.get("start"));
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? startRaw : 0;

  try {
    // Meta is cached (10-min TTL); await it up front so the stage name → IDs
    // mapping is available before the list call is built.
    const [meta, enums] = await Promise.all([getBitrixCrmMeta(), getBitrixDealEnums([UF_ISSUE])]);

    const issueEnum = enums[UF_ISSUE] ?? {};

    // Bitrix matches STAGE_ID against an array of STATUS_IDs, so the stage
    // filter value is a string[] — widen the type from the string-only URL map.
    const stageFilter: Record<string, string | string[]> = { ...filter };
    if (stageName) {
      const ids = meta.stageIdsByName[stageName] ?? [];
      // Unknown stage name → no rows, rather than silently ignoring the filter.
      stageFilter.STAGE_ID = ids.length > 0 ? ids : ["__none__"];
    }
    if (issueName) {
      // Resolve the issue label back to its enum item ID (label → ID).
      const issueId = Object.entries(issueEnum).find(([, label]) => label === issueName)?.[0];
      // Unknown issue label → no rows, rather than silently ignoring the filter.
      stageFilter[UF_ISSUE] = issueId ?? "__none__";
    }

    // Tanggal Dibuat range → DATE_CREATE. The "to" bound is exclusive on the
    // next day so the whole end day is included.
    if (isIsoDay(createdFrom)) stageFilter[">=DATE_CREATE"] = `${createdFrom}T00:00:00`;
    if (isIsoDay(createdTo)) stageFilter["<DATE_CREATE"] = `${nextDay(createdTo)}T00:00:00`;

    // Tanggal Database range → UF_DB_DATE. Date-only field, so bound on the bare
    // ISO day; "to" is inclusive via <= on the same day.
    if (isIsoDay(dbFrom)) stageFilter[`>=${UF_DB_DATE}`] = dbFrom;
    if (isIsoDay(dbTo)) stageFilter[`<=${UF_DB_DATE}`] = dbTo;

    const { items, total, next } = await bitrixList<RawDeal>("crm.deal.list", {
      select: DEAL_SELECT,
      ...(Object.keys(stageFilter).length > 0 && { filter: stageFilter }),
      order,
      start,
    });

    const [contactMap, userMap] = await Promise.all([
      resolveBitrixContactInfo(items.map((d) => d.CONTACT_ID ?? "").filter(Boolean)),
      resolveBitrixUsers(items.map((d) => d.ASSIGNED_BY_ID ?? "").filter(Boolean)),
    ]);

    const rows = items.map((d) => {
      const contact = d.CONTACT_ID ? contactMap[d.CONTACT_ID] : undefined;
      const issueId = d[UF_ISSUE];
      return {
      id: d.ID,
      title: d.TITLE ?? "Tanpa judul",
      stageId: d.STAGE_ID,
      stage: (d.STAGE_ID && meta.stages[d.STAGE_ID]) ?? d.STAGE_ID ?? "-",
      stageSemantic: (d.STAGE_ID && meta.stageSemantics[d.STAGE_ID]) ?? semanticOf(d.STAGE_ID),
      stageColor: (d.STAGE_ID && meta.stageColors[d.STAGE_ID]) || null,
      stageOrder: d.STAGE_ID ? meta.stageCatalog.findIndex((s) => s.name === meta.stages[d.STAGE_ID as string]) : -1,
      pipelineId: d.CATEGORY_ID,
      pipeline: (d.CATEGORY_ID && meta.pipelines[d.CATEGORY_ID]) ?? "-",
      clientId: d.CONTACT_ID,
      client: contact?.name ?? null,
      phone: contact?.phone ?? null,
      opportunity: d.OPPORTUNITY ? Number(d.OPPORTUNITY) : 0,
      currency: d.CURRENCY_ID ?? "IDR",
      sourceId: d.SOURCE_ID,
      source: (d.SOURCE_ID && meta.sources[d.SOURCE_ID]) ?? labelFromSourceId(d.SOURCE_ID),
      sourceDescription: d.SOURCE_DESCRIPTION?.trim() || null,
      assignedById: d.ASSIGNED_BY_ID,
      assignedBy: (d.ASSIGNED_BY_ID && userMap[d.ASSIGNED_BY_ID]) ?? null,
      issue: (issueId && issueEnum[issueId]) ?? null,
      adsUrl: d[UF_ADS_URL]?.trim() || null,
      adsHeadline: d[UF_ADS_HEADLINE]?.trim() || null,
      adsBody: cleanBbcode(d[UF_ADS_BODY]),
      dbDate: d[UF_DB_DATE]?.trim() || null,
      dateCreate: d.DATE_CREATE,
      };
    });

    return Response.json({
      items: rows,
      total,
      next: next ?? null,
      // Ordered stage funnel (name/color/semantic) — powers the stage filter
      // dropdown and the per-row segmented progress bar on the client.
      stageCatalog: meta.stageCatalog,
      // Distinct issue labels — powers the issue filter dropdown on the client.
      issueCatalog: Object.values(issueEnum),
    });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/deals]", e);
    return Response.json({ error: "Gagal mengambil data transaksi." }, { status: 500 });
  }
}

// True for a bare ISO calendar day ("2026-08-14"), the shape the date filters
// expect. Rejects datetimes and malformed input so a bad param is ignored
// rather than silently narrowing the result set.
function isIsoDay(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// Day after an ISO day via UTC calendar math — avoids timezone drift for a
// date-only boundary (used to make the "to" bound inclusive of the whole day).
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Ad body text arrives with Bitrix BBCode tags ([b]…[/b], [br]) — strip them so
// the table shows plain text. Returns null when empty after stripping.
function cleanBbcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/\[br\]/gi, " ")
    .replace(/\[\/?[a-z][^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

// Fallback label when a SOURCE_ID isn't in the resolved status map.
function labelFromSourceId(source: string | null): string {
  if (!source) return "-";
  const raw = source.split("|").pop() ?? source;
  if (/tiktok/i.test(raw)) return "TikTok";
  if (/instagram|ig_|fbinstagram/i.test(raw)) return "Instagram";
  if (/whatsapp|_wa_|wazzup/i.test(raw)) return "WhatsApp";
  if (/facebook|fb_/i.test(raw)) return "Facebook";
  return raw.replace(/ASKARASOFT_CONN_/i, "").replace(/_/g, " ");
}

// Rough win/lose semantic from the stage suffix (Bitrix stores STAGE_SEMANTIC_ID
// but we skip fetching it per row; the suffix is reliable for WON/LOSE).
function semanticOf(stageId: string | null): "won" | "lost" | "process" {
  if (!stageId) return "process";
  const suffix = stageId.includes(":") ? stageId.split(":")[1] : stageId;
  if (suffix === "WON") return "won";
  if (suffix === "LOSE" || suffix === "APOLOGY") return "lost";
  return "process";
}
