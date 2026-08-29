import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { bitrixListAll, searchBitrixUsers, resolveBitrixUsers, BitrixApiError } from "@/lib/bitrix";
import { avgSeconds } from "@/lib/bitrix-response";
import { resolveSessionMetrics } from "@/lib/bitrix-session-metrics";
import { parseSubject, channelFromSourceId } from "@/lib/bitrix-conversation";

const PROVIDER_ID = "IMOPENLINES_SESSION";

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

interface ConversationRow {
  id: string;
  sessionId: string;
  dealId: string | null;
  direction: "inbound" | "outbound";
  closed: boolean;
  client: string | null;
  phone: string | null;
  venue: string | null;
  channel: string;
  responsible: string | null;
  responsibleId: string | null;
  createdAt: string | null;
  closedAt: string | null;
  lastMessageAt: string | null;
  durationSec: number | null;
  avgResponseSec: number | null;
  transferCount?: number;
  transferred?: boolean;
  responded?: boolean;
}

const MAX_PAGES = 100; // up to 5000 rows.

export async function GET(request: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "bitrix", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`bitrix-percakapan-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  try {
    const rows = await fetchFilteredConversations(searchParams);
    if (format === "pdf") return pdfResponse(rows);
    return xlsxResponse(rows);
  } catch (e) {
    if (e instanceof BitrixApiError) {
      const status = e.code === "no_config" ? 503 : 502;
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[api/bitrix/percakapan/export]", e);
    return Response.json({ error: "Gagal mengekspor data percakapan." }, { status: 500 });
  }
}

async function fetchFilteredConversations(searchParams: URLSearchParams): Promise<ConversationRow[]> {
  // Base filter — everything EXCEPT "%SUBJECT" and RESPONSIBLE_ID, reused for
  // both legs of the "q" union below (client OR sales), mirroring the on-screen
  // GET route so the export matches what's shown.
  const base: Record<string, unknown> = { PROVIDER_ID };

  const direction = searchParams.get("direction")?.trim();
  if (direction === "1" || direction === "2") base.DIRECTION = direction;

  const status = searchParams.get("status")?.trim();
  if (status === "open") base.COMPLETED = "N";
  if (status === "closed") base.COMPLETED = "Y";

  const q = searchParams.get("q")?.trim();

  // Legacy sales filter — superseded by the "q" union below, kept tolerant.
  const responsibleId = searchParams.get("responsible")?.trim();
  if (responsibleId) base.RESPONSIBLE_ID = responsibleId;

  const createdFrom = searchParams.get("createdFrom")?.trim();
  const createdTo = searchParams.get("createdTo")?.trim();
  if (isIsoDay(createdFrom)) base[">=CREATED"] = `${createdFrom}T00:00:00`;
  if (isIsoDay(createdTo)) base["<CREATED"] = `${nextDay(createdTo)}T00:00:00`;

  const transferred = searchParams.get("transferred")?.trim();
  const responded = searchParams.get("responded")?.trim();

  let items: RawActivity[];

  if (q) {
    // Client OR sales: one query on SUBJECT, one on RESPONSIBLE_ID (only when
    // "q" resolves to at least one Bitrix user), merged + deduped by ID.
    const salesIds = (await searchBitrixUsers(q)).map((u) => u.id);

    const subjectMatches = await bitrixListAll<RawActivity>(
      "crm.activity.list",
      { select: ACTIVITY_SELECT, filter: { ...base, "%SUBJECT": q }, order: { ID: "DESC" } },
      MAX_PAGES,
    );

    const responsibleMatches =
      salesIds.length > 0
        ? await bitrixListAll<RawActivity>(
            "crm.activity.list",
            { select: ACTIVITY_SELECT, filter: { ...base, RESPONSIBLE_ID: salesIds }, order: { ID: "DESC" } },
            MAX_PAGES,
          )
        : { items: [] as RawActivity[] };

    const merged = new Map<string, RawActivity>();
    for (const a of subjectMatches.items) merged.set(a.ID, a);
    for (const a of responsibleMatches.items) merged.set(a.ID, a);
    items = [...merged.values()].sort((a, b) => Number(b.ID) - Number(a.ID));
  } else {
    const res = await bitrixListAll<RawActivity>(
      "crm.activity.list",
      { select: ACTIVITY_SELECT, filter: base, order: { ID: "DESC" } },
      MAX_PAGES,
    );
    items = res.items;
  }

  const userMap = await resolveBitrixUsers(items.map((a) => a.RESPONSIBLE_ID ?? "").filter(Boolean));

  const sessions = items.map((a) => ({
    sessionId: a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID,
    lastUpdated: a.LAST_UPDATED,
  }));
  const sessionMetrics = await resolveSessionMetrics(sessions);

  return items
    .map((a) => {
      const parsed = parseSubject(a.SUBJECT);
      const sessionId = a.ASSOCIATED_ENTITY_ID ?? stripImol(a.ORIGIN_ID) ?? a.ID;
      const dealId = a.OWNER_TYPE_ID === "2" ? a.OWNER_ID : null;
      const m = sessionMetrics[sessionId] ?? { samples: [], events: [], hasPending: false };

      return {
        id: a.ID,
        sessionId,
        dealId,
        direction: (a.DIRECTION === "2" ? "outbound" : "inbound") as "outbound" | "inbound",
        closed: a.COMPLETED === "Y",
        client: parsed.name,
        phone: parsed.phone,
        venue: parsed.venue,
        channel: parsed.channel ?? channelFromSourceId(a.RESULT_SOURCE_ID),
        responsible: (a.RESPONSIBLE_ID && userMap[a.RESPONSIBLE_ID]) ?? null,
        responsibleId: a.RESPONSIBLE_ID,
        createdAt: a.CREATED ?? a.START_TIME,
        closedAt: a.COMPLETED === "Y" ? a.END_TIME : null,
        lastMessageAt: a.LAST_UPDATED,
        durationSec: durationSeconds(a.START_TIME, a.END_TIME),
        avgResponseSec: m.samples.length > 0 ? avgSeconds(m.samples) : null,
        transferCount: m.events.length,
        transferred: m.events.length > 0,
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

function stripImol(origin: string | null): string | null {
  if (!origin) return null;
  const m = origin.match(/IMOL_(\d+)/);
  return m ? m[1] : origin;
}

function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 1000);
}

function fmtDuration(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} mnt`);
  if (s > 0 || parts.length === 0) parts.push(`${s} dtk`);
  return parts.join(" ");
}

function fmtResponse(sec: number | null, transferred?: boolean): string {
  if (sec !== null) return fmtDuration(sec);
  return transferred ? "Belum dibalas" : "Belum transfer";
}

function fmtStatusRespons(responded?: boolean): string {
  return responded ? "Sudah Dibalas" : "Belum Dibalas";
}

// Detik/Menit/Jam columns — mirror the Detik/Menit/Jam columns shown ahead of
// "Response" in the web table (same shape as the Response Sales export).
function fmtDetik(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  return String(Math.round(sec));
}

function fmtMenit(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  return String(Math.round(sec / 60));
}

function fmtJam(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function stamp(): string {
  return new Date().toISOString().split("T")[0];
}

async function xlsxResponse(rows: ConversationRow[]): Promise<Response> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Percakapan");

  const headers = [
    "Sesi",
    "Tipe",
    "Status",
    "Saluran",
    "Klien",
    "Telepon",
    "Venue",
    "Karyawan",
    "Deal ID",
    "Dibuat",
    "Ditutup",
    "Detik",
    "Menit",
    "Jam",
    "Response",
    "Status Respons",
    "Durasi",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });

  for (const r of rows) {
    ws.addRow([
      r.sessionId,
      r.direction === "inbound" ? "Inbound" : "Outbound",
      r.closed ? "Percakapan ditutup" : "Agen merespons",
      r.channel,
      r.client ?? "Guest",
      r.phone ?? "",
      r.venue ?? "",
      r.responsible ?? (r.responsibleId ? `#${r.responsibleId}` : ""),
      r.dealId ?? "",
      fmtDateTime(r.createdAt),
      fmtDateTime(r.closedAt),
      fmtDetik(r.avgResponseSec),
      fmtMenit(r.avgResponseSec),
      fmtJam(r.avgResponseSec),
      fmtResponse(r.avgResponseSec, r.transferred),
      fmtStatusRespons(r.responded),
      fmtDuration(r.durationSec),
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
      "Content-Disposition": `attachment; filename="bitrix-percakapan-${stamp()}.xlsx"`,
    },
  });
}

async function pdfResponse(rows: ConversationRow[]): Promise<Response> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 24;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colWidths = [45, 40, 60, 70, 90, 80, 55, 70, 55, 85, 85, 40, 40, 50, 60, 60, 60];
  const headers = ["Sesi", "Tipe", "Status", "Saluran", "Klien", "Telepon", "Venue", "Karyawan", "Deal ID", "Dibuat", "Ditutup", "Detik", "Menit", "Jam", "Response", "Status Respons", "Durasi"];
  const tableLeft = margin;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 20;
  let y = margin + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Percakapan Bitrix24", margin, y);
  y += 16;

  function drawHeader(): void {
    doc.setFillColor(15, 65, 89);
    doc.rect(tableLeft, y, tableWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
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

  for (const r of rows) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    const cells = [
      r.sessionId,
      r.direction === "inbound" ? "Inbound" : "Outbound",
      r.closed ? "Ditutup" : "Agen merespons",
      r.channel,
      r.client ?? "Guest",
      r.phone ?? "",
      r.venue ?? "",
      r.responsible ?? (r.responsibleId ? `#${r.responsibleId}` : ""),
      r.dealId ?? "",
      fmtDateTime(r.createdAt),
      fmtDateTime(r.closedAt),
      fmtDetik(r.avgResponseSec),
      fmtMenit(r.avgResponseSec),
      fmtJam(r.avgResponseSec),
      fmtResponse(r.avgResponseSec, r.transferred),
      fmtStatusRespons(r.responded),
      fmtDuration(r.durationSec),
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
      "Content-Disposition": `attachment; filename="bitrix-percakapan-${stamp()}.pdf"`,
    },
  });
}
