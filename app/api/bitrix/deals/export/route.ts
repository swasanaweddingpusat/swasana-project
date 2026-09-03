import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import {
  bitrixListAll,
  getBitrixCrmMeta,
  getBitrixDealEnums,
  resolveBitrixContactInfo,
  resolveBitrixUsers,
  BitrixApiError,
} from "@/lib/bitrix";

// Custom (UF_CRM_*) fields carrying the ad-tracking + issue data. Mirrors
// app/api/bitrix/deals/route.ts — these ids are portal-specific.
const UF_ISSUE = "UF_CRM_1768930533046";
const UF_SUB_ISSUE = "UF_CRM_1774952346733";
const UF_ADS_URL = "UF_CRM_1770698079121";
const UF_ADS_HEADLINE = "UF_CRM_1770698102639";
const UF_ADS_BODY = "UF_CRM_1770698208232";
const UF_DB_DATE = "UF_CRM_1786680629702";

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
  UF_SUB_ISSUE,
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
  [key: string]: string | null | undefined;
}

interface DealRow {
  id: string;
  title: string;
  stage: string;
  pipeline: string;
  client: string | null;
  phone: string | null;
  opportunity: number;
  currency: string;
  source: string;
  sourceDescription: string | null;
  assignedById: string | null;
  assignedBy: string | null;
  issue: string | null;
  subIssue: string | null;
  adsUrl: string | null;
  adsHeadline: string | null;
  adsBody: string | null;
  dbDate: string | null;
  dateCreate: string | null;
}

const MAX_PAGES = 100; // up to 5000 rows — comfortably covers a large filtered export.

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-deals-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  try {
    const rows = await fetchFilteredDeals(searchParams);
    if (format === "pdf") return pdfResponse(rows);
    return xlsxResponse(rows);
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/deals/export]", e);
    return Response.json({ error: "Gagal mengekspor data transaksi." }, { status: 500 });
  }
}

async function fetchFilteredDeals(searchParams: URLSearchParams): Promise<DealRow[]> {
  const [meta, enums] = await Promise.all([getBitrixCrmMeta(), getBitrixDealEnums([UF_ISSUE, UF_SUB_ISSUE])]);
  const issueEnum = enums[UF_ISSUE] ?? {};
  const subIssueEnum = enums[UF_SUB_ISSUE] ?? {};

  // Build the same filter the Transaksi page applies.
  const filter: Record<string, string | string[]> = {};
  const q = searchParams.get("q")?.trim();
  if (q) filter["%TITLE"] = q;

  const stageName = searchParams.get("stage")?.trim();
  if (stageName) {
    const ids = meta.stageIdsByName[stageName] ?? [];
    filter.STAGE_ID = ids.length > 0 ? ids : ["__none__"];
  }

  const issueName = searchParams.get("issue")?.trim();
  if (issueName) {
    const issueId = Object.entries(issueEnum).find(([, label]) => label === issueName)?.[0];
    filter[UF_ISSUE] = issueId ?? "__none__";
  }

  const subIssueName = searchParams.get("subIssue")?.trim();
  if (subIssueName) {
    const subIssueId = Object.entries(subIssueEnum).find(([, label]) => label === subIssueName)?.[0];
    filter[UF_SUB_ISSUE] = subIssueId ?? "__none__";
  }

  const salesId = searchParams.get("salesId")?.trim();
  if (salesId) filter.ASSIGNED_BY_ID = salesId;

  const sourceId = searchParams.get("sourceId")?.trim();
  if (sourceId) filter.SOURCE_ID = sourceId;

  const createdFrom = searchParams.get("createdFrom")?.trim();
  const createdTo = searchParams.get("createdTo")?.trim();
  if (isIsoDay(createdFrom)) filter[">=DATE_CREATE"] = `${createdFrom}T00:00:00`;
  if (isIsoDay(createdTo)) filter["<DATE_CREATE"] = `${nextDay(createdTo)}T00:00:00`;

  const dbFrom = searchParams.get("dbFrom")?.trim();
  const dbTo = searchParams.get("dbTo")?.trim();
  if (isIsoDay(dbFrom)) filter[`>=${UF_DB_DATE}`] = dbFrom;
  if (isIsoDay(dbTo)) filter[`<=${UF_DB_DATE}`] = dbTo;

  const pipeline = searchParams.get("pipeline")?.trim();
  if (pipeline) filter.CATEGORY_ID = pipeline;

  const { items } = await bitrixListAll<RawDeal>(
    "crm.deal.list",
    {
      ...(Object.keys(filter).length > 0 && { filter }),
      select: DEAL_SELECT,
      order: { DATE_CREATE: "DESC" },
    },
    MAX_PAGES,
  );

  const [contactMap, userMap] = await Promise.all([
    resolveBitrixContactInfo(items.map((d) => d.CONTACT_ID ?? "").filter(Boolean)),
    resolveBitrixUsers(items.map((d) => d.ASSIGNED_BY_ID ?? "").filter(Boolean)),
  ]);

  return items.map((d) => {
    const contact = d.CONTACT_ID ? contactMap[d.CONTACT_ID] : undefined;
    const issueId = d[UF_ISSUE];
    const subIssueId = d[UF_SUB_ISSUE];
    return {
      id: d.ID,
      title: d.TITLE ?? "Tanpa judul",
      stage: (d.STAGE_ID && meta.stages[d.STAGE_ID]) ?? d.STAGE_ID ?? "-",
      pipeline: (d.CATEGORY_ID && meta.pipelines[d.CATEGORY_ID]) ?? "-",
      client: contact?.name ?? null,
      phone: contact?.phone ?? null,
      opportunity: d.OPPORTUNITY ? Number(d.OPPORTUNITY) : 0,
      currency: d.CURRENCY_ID ?? "IDR",
      source: (d.SOURCE_ID && meta.sources[d.SOURCE_ID]) ?? labelFromSourceId(d.SOURCE_ID),
      sourceDescription: d.SOURCE_DESCRIPTION?.trim() || null,
      assignedById: d.ASSIGNED_BY_ID,
      assignedBy: (d.ASSIGNED_BY_ID && userMap[d.ASSIGNED_BY_ID]) ?? null,
      issue: (issueId && issueEnum[issueId]) ?? null,
      subIssue: (subIssueId && subIssueEnum[subIssueId]) ?? null,
      adsUrl: d[UF_ADS_URL]?.trim() || null,
      adsHeadline: d[UF_ADS_HEADLINE]?.trim() || null,
      adsBody: cleanBbcode(d[UF_ADS_BODY]),
      dbDate: d[UF_DB_DATE]?.trim() || null,
      dateCreate: d.DATE_CREATE,
    };
  });
}

async function xlsxResponse(rows: DealRow[]): Promise<Response> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Transaksi");

  const headers = [
    "ID",
    "Transaksi",
    "Nama Client",
    "Telepon",
    "Penanggung Jawab",
    "Tahap",
    "Pipeline",
    "Sumber Informasi",
    "Issue",
    "Sub Issue",
    "Nilai",
    "Ads Source URL",
    "Ads Headline",
    "Ads Body",
    "Tanggal Database",
    "Dibuat",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });

  for (const d of rows) {
    ws.addRow([
      d.id,
      d.title,
      d.client ?? "",
      d.phone ?? "",
      d.assignedBy ?? (d.assignedById ? `#${d.assignedById}` : ""),
      d.stage,
      d.pipeline,
      d.source,
      d.issue ?? "",
      d.subIssue ?? "",
      d.opportunity ?? 0,
      d.adsUrl ?? "",
      d.adsHeadline ?? "",
      d.adsBody ?? "",
      d.dbDate ?? "",
      d.dateCreate ?? "",
    ]);
  }

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });

  const buf = await wb.xlsx.writeBuffer();
  const ab =
    buf instanceof ArrayBuffer
      ? buf
      : (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

  return new Response(ab as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bitrix-transaksi-${stamp()}.xlsx"`,
    },
  });
}

async function pdfResponse(rows: DealRow[]): Promise<Response> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 24;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // Ringkas: drop kolom Ads URL/Headline/Body yang bikin tabel terlalu lebar.
  const colWidths = [35, 105, 80, 65, 75, 50, 50, 60, 50, 50, 55, 50, 55];
  const headers = [
    "ID",
    "Transaksi",
    "Nama Client",
    "Telepon",
    "PIC",
    "Tahap",
    "Pipeline",
    "Sumber",
    "Issue",
    "Sub Issue",
    "Nilai",
    "Tgl Database",
    "Dibuat",
  ];
  const tableLeft = margin;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  let y = margin + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Transaksi Bitrix24", margin, y);
  y += 16;

  function drawHeader(): void {
    doc.setFillColor(15, 65, 89);
    doc.rect(tableLeft, y, tableWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    let x = tableLeft;
    headers.forEach((h, i) => {
      doc.text(h, x + 3, y + 13);
      x += colWidths[i];
    });
    y += headerHeight + 4;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
  }

  drawHeader();

  for (const d of rows) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    const cells = [
      d.id,
      d.title,
      d.client ?? "",
      d.phone ?? "",
      d.assignedBy ?? (d.assignedById ? `#${d.assignedById}` : ""),
      d.stage,
      d.pipeline,
      d.source,
      d.issue ?? "",
      d.subIssue ?? "",
      d.opportunity ? String(d.opportunity) : "0",
      d.dbDate ?? "",
      d.dateCreate ?? "",
    ];
    const cellLines = cells.map((c, i) => doc.splitTextToSize(c, colWidths[i] - 6) as string[]);
    const maxLines = Math.max(...cellLines.map((l) => l.length));
    const rowHeight = Math.max(14, maxLines * 8 + 4);

    let x = tableLeft;
    cells.forEach((c, i) => {
      doc.text(cellLines[i], x + 3, y + 8);
      x += colWidths[i];
    });
    y += rowHeight;
  }

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Response(ab, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bitrix-transaksi-${stamp()}.pdf"`,
    },
  });
}

function stamp(): string {
  return new Date().toISOString().split("T")[0];
}

function isIsoDay(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function cleanBbcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/\[br\]/gi, " ")
    .replace(/\[\/?[a-z][^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function labelFromSourceId(source: string | null): string {
  if (!source) return "-";
  const raw = source.split("|").pop() ?? source;
  if (/tiktok/i.test(raw)) return "TikTok";
  if (/instagram|ig_|fbinstagram/i.test(raw)) return "Instagram";
  if (/whatsapp|_wa_|wazzup/i.test(raw)) return "WhatsApp";
  if (/facebook|fb_/i.test(raw)) return "Facebook";
  return raw.replace(/ASKARASOFT_CONN_/i, "").replace(/_/g, " ");
}
