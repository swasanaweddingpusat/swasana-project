import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixListAll, getBitrixDealEnums, stripImol, BitrixApiError } from "@/lib/bitrix";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";
import { resolveSessionMetrics } from "@/lib/bitrix-session-metrics";
import { formatCsReportWhatsApp, type CsReportBucket, type CsReportData } from "@/lib/cs-report-format";

// Portal-specific custom fields (see /api/bitrix/overview for the same ids).
const UF_ADS_URL = "UF_CRM_1770698079121"; // ad source URL (fb.me / instagram post)
const UF_ISSUE = "UF_CRM_1768930533046"; // enum: Leads / No Response / Spam / Komplain …
const UF_DB_DATE = "UF_CRM_1786680629702"; // date: "Tanggal Database" — when the lead entered the database

// Open Lines conversation activities — same provider Response Sales / Percakapan use.
const PROVIDER_ID = "IMOPENLINES_SESSION";

interface RawActivity {
  ID: string;
  SUBJECT: string | null;
  RESULT_SOURCE_ID: string | null;
}

interface RawDeal {
  ID: string;
  [key: string]: string | null | undefined;
}

/**
 * GET /api/bitrix/cs-report?date=2026-09-24
 *
 * Aggregates the CS division's daily incoming-chat report — the same figures
 * CS currently compiles by hand into a WhatsApp recap:
 *   • Total/Sumber Chat Masuk — every Open Lines session opened that day (all
 *     channels), same source `crm.activity.list` Percakapan reads.
 *   • Chat Jadi Database / Database Respon / No Respon — deals whose "Tanggal
 *     Database" (UF_DB_DATE) falls that day, response status via the same
 *     linked-session metrics Response Sales / Overview use.
 *   • Spam/Prank / Sumber Iklan Spam / Organik — deals flagged Spam/Prank
 *     (UF_ISSUE), bucketed by ad URL (UF_ADS_URL); no ad URL → Organik.
 *
 * Defaults to "yesterday" when no `date` given. Also returns `message`, the
 * exact WhatsApp text CS can copy/send in place of the manual recap.
 */
export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-cs-report:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date");
  const date = isIsoDay(dateRaw) ? dateRaw : yesterday();

  try {
    const enums = await getBitrixDealEnums([UF_ISSUE]);
    const issueEnum = enums[UF_ISSUE] ?? {};

    const [{ items: activities }, { items: deals }] = await Promise.all([
      bitrixListAll<RawActivity>("crm.activity.list", {
        select: ["ID", "SUBJECT", "RESULT_SOURCE_ID"],
        filter: {
          PROVIDER_ID,
          ">=CREATED": `${date}T00:00:00`,
          "<CREATED": `${nextDay(date)}T00:00:00`,
        },
        order: { ID: "DESC" },
      }),
      bitrixListAll<RawDeal>("crm.deal.list", {
        select: ["ID", UF_ADS_URL, UF_ISSUE],
        filter: {
          [`>=${UF_DB_DATE}`]: date,
          [`<=${UF_DB_DATE}`]: date,
        },
        order: { ID: "DESC" },
      }),
    ]);

    // Total + Sumber Chat Masuk — bucketed by the same channel label
    // Percakapan resolves (trailing "(...)" on the session subject, falling
    // back to the raw source id).
    const totalChatMasuk = activities.length;
    const sources: CsReportBucket[] = bucketize(activities, (a) => {
      const channel = parseSubject(a.SUBJECT).channel;
      return channel ?? channelFromSourceId(a.RESULT_SOURCE_ID);
    });

    // Spam/Prank + Sumber Iklan Spam — deals whose issue enum label mentions
    // "spam"/"prank", bucketed by ad URL; no ad URL → Organik.
    let spamPrank = 0;
    const adCounts = new Map<string, number>();
    let organikSpam = 0;
    for (const d of deals) {
      const issueId = d[UF_ISSUE];
      const label = issueId ? (issueEnum[issueId]?.toLowerCase() ?? "") : "";
      if (!label.includes("spam") && !label.includes("prank")) continue;
      spamPrank++;
      const url = (d[UF_ADS_URL] ?? "").trim();
      if (!url) organikSpam++;
      else adCounts.set(url, (adCounts.get(url) ?? 0) + 1);
    }
    const adsSpam = [...adCounts.entries()]
      .map(([url, count]) => ({ key: url, url, count }))
      .sort((a, b) => b.count - a.count);

    const chatJadiDatabase = deals.length;

    // Database Respon / No Respon — a deal counts as "no respon" if ANY of
    // its linked Open Lines sessions still has a pending anchor, mirroring
    // the Overview report's per-deal response classification. Deals with no
    // linked session (created without a chat trail) default to "respon".
    const dealIds = deals.map((d) => d.ID);
    let databaseRespon = 0;
    let databaseNoRespon = 0;

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

      const sessionIdsByDeal = new Map<string, Set<string>>();
      const lastUpdatedBySession = new Map<string, string | null>();
      for (const a of acts) {
        const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
        if (!lastUpdatedBySession.has(sessionId)) lastUpdatedBySession.set(sessionId, a.LAST_UPDATED);
        if (!a.OWNER_ID) continue;
        const set = sessionIdsByDeal.get(a.OWNER_ID) ?? new Set<string>();
        set.add(sessionId);
        sessionIdsByDeal.set(a.OWNER_ID, set);
      }

      const metrics = await resolveSessionMetrics(
        [...lastUpdatedBySession.entries()].map(([sessionId, lastUpdated]) => ({ sessionId, lastUpdated })),
      );

      for (const dealId of dealIds) {
        const sessionIds = sessionIdsByDeal.get(dealId);
        const hasPending = sessionIds ? [...sessionIds].some((sid) => metrics[sid]?.hasPending === true) : false;
        if (hasPending) databaseNoRespon++;
        else databaseRespon++;
      }
    } else {
      databaseRespon = 0;
      databaseNoRespon = 0;
    }

    const data: CsReportData = {
      date,
      totalChatMasuk,
      chatJadiDatabase,
      databaseRespon,
      databaseNoRespon,
      spamPrank,
      adsSpam,
      organikSpam,
      sources,
    };

    return Response.json({ ...data, message: formatCsReportWhatsApp(data) });
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/cs-report]", e);
    return Response.json({ error: "Gagal mengambil ringkasan chat CS." }, { status: 500 });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isIsoDay(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function yesterday(): string {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function bucketize(rows: RawActivity[], keyOf: (row: RawActivity) => string): CsReportBucket[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}
