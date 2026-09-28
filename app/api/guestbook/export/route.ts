import { resolveGuestbookPhotoUrl } from "@/app/(private)/(general)/guestbook/_components/photo-url";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import { db } from "@/lib/db";
import { requirePermissionForRoute } from "@/lib/permissions";
import { buildGuestbookWhere, type GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import type { ProofFiles } from "@/lib/validations/guestbook";
import type { Prisma } from "@prisma/client";
import type { Row, Worksheet } from "exceljs";
import { z } from "zod";

const EXPORT_BATCH_SIZE = 1_000;
const EXCEL_MAX_DATA_ROWS = 1_048_575;
const BRAND_INK = "FF0F4159";
const BRAND_GOLD = "FFD4A547";
const SOFT_GRAY = "FFF5F5F5";
const WHITE = "FFFFFFFF";

const guestbookExportQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    venueIds: z.array(z.string().min(1)).max(100).optional(),
    hostId: z.string().trim().min(1).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    categories: z.array(z.enum(["WEDDINGS", "MICE", "no_package"])).max(3).optional(),
    statusIds: z.array(z.string().min(1)).max(100).optional(),
    sourceOfInformationIds: z.array(z.string().min(1)).max(100).optional(),
    festivalIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Rentang tanggal tidak valid.",
  });

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  WEDDINGS: "Wedding",
  MICE: "MICE",
};

const ONLINE_MEDIUM_LABELS: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  whatsapp_call: "WhatsApp Call",
  microsoft_teams: "Microsoft Teams",
  other: "Lainnya",
};

const guestbookExportSelect = {
  id: true,
  visitorName: true,
  companyName: true,
  eventCategory: true,
  guestCode: true,
  phoneNumber: true,
  email: true,
  onlineMedium: true,
  meetingUrl: true,
  meetingLocation: true,
  scheduledAt: true,
  checkInAt: true,
  notes: true,
  bitrixContactId: true,
  bitrixName: true,
  bitrixSourceInfo: true,
  bitrixAdsUrl: true,
  commitVisitDate: true,
  commitPayDate: true,
  confirmedGuestCount: true,
  confirmedGuestCountAt: true,
  actualGuestCount: true,
  attendanceConfirmedAt: true,
  createdAt: true,
  updatedAt: true,
  prospectStatus: { select: { name: true } },
  host: { select: { fullName: true } },
  sales: { select: { fullName: true } },
  attendanceConfirmedBy: { select: { fullName: true } },
  venue: { select: { name: true } },
  sourceOfInformation: { select: { name: true } },
  package: {
    select: {
      packageName: true,
      category: true,
      pax: true,
      sellingPrice: true,
      margin: true,
      categoryPrices: {
        select: { categoryName: true, basePrice: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  },
  segment: { select: { name: true } },
  festival: { select: { name: true } },
  createdBy: { select: { fullName: true } },
  proofFiles: true,
} satisfies Prisma.GuestbookEntrySelect;

type GuestbookExportRow = Prisma.GuestbookEntryGetPayload<{ select: typeof guestbookExportSelect }>;
type ExportQuery = z.infer<typeof guestbookExportQuerySchema>;

const DATA_HEADERS = [
  "No.",
  "ID Data",
  "Guest Code",
  "Nama Tamu",
  "Company / Institusi",
  "Kategori Event",
  "Segmen",
  "Telepon",
  "Email",
  "Status Prospek",
  "Sumber Informasi",
  "Venue",
  "Lokasi Kunjungan",
  "Bertemu / Host",
  "Sales Owner",
  "Paket",
  "Kategori Paket",
  "Pax Paket",
  "Harga Jual Paket",
  "Margin Paket",
  "Harga Dasar per Kategori",
  "Festival",
  "Check-in",
  "Jadwal",
  "Medium Online",
  "Link Meeting",
  "Catatan",
  "Commit Visit",
  "Commit Bayar",
  "Bitrix Contact ID",
  "Nama dari Bitrix",
  "Sumber dari Bitrix",
  "Bitrix Ads URL",
  "Jumlah Tamu RSVP",
  "Waktu Konfirmasi RSVP",
  "Jumlah Tamu Aktual",
  "Status Kehadiran",
  "Waktu Konfirmasi Hadir",
  "Dikonfirmasi oleh",
  "Dicatat oleh",
  "Tanggal Dibuat",
  "Terakhir Diubah",
  "Bukti Foto Visit",
  "Bukti Chat",
  "Bukti Reschedule",
  "Bukti Lost",
] as const;

const DATA_COLUMN_WIDTHS = [
  7, 38, 18, 24, 24, 16, 20, 18, 28, 22, 22, 22, 24, 22, 22, 28, 18, 12, 18, 16, 34, 24,
  21, 21, 20, 34, 40, 18, 18, 22, 24, 28, 34, 18, 23, 20, 18, 23, 22, 22, 21, 21, 34, 34, 34, 34,
] as const;

function parseListParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function parseExportQuery(searchParams: URLSearchParams): ExportQuery | null {
  const result = guestbookExportQuerySchema.safeParse({
    search: searchParams.get("search")?.trim() || undefined,
    venueIds: parseListParam(searchParams.get("venueIds")),
    hostId: searchParams.get("hostId")?.trim() || undefined,
    from: searchParams.get("from")?.trim() || undefined,
    to: searchParams.get("to")?.trim() || undefined,
    categories: parseListParam(searchParams.get("categories")),
    statusIds: parseListParam(searchParams.get("statusIds")),
    sourceOfInformationIds: parseListParam(searchParams.get("sourceOfInformationIds")),
    festivalIds: parseListParam(searchParams.get("festivalIds")),
  });
  return result.success ? result.data : null;
}

function eventCategoryLabel(row: GuestbookExportRow): string {
  const category = row.eventCategory ?? row.package?.category ?? null;
  return category ? EVENT_CATEGORY_LABELS[category] ?? category : "Tanpa kategori";
}

function resolveProofUrls(proofFilesValue: Prisma.JsonValue | null): Record<keyof ProofFiles, string> {
  const proofFiles = (proofFilesValue ?? null) as ProofFiles | null;
  return {
    photo: resolveGuestbookPhotoUrl(proofFiles?.photo?.path) ?? "",
    chat: resolveGuestbookPhotoUrl(proofFiles?.chat?.path) ?? "",
    lost: resolveGuestbookPhotoUrl(proofFiles?.lost?.path) ?? "",
    reschedule: resolveGuestbookPhotoUrl(proofFiles?.reschedule?.path) ?? "",
  };
}

async function fetchAllGuestbookRows(where: Prisma.GuestbookEntryWhereInput): Promise<GuestbookExportRow[]> {
  const rows: GuestbookExportRow[] = [];
  let cursorId: string | undefined;

  while (true) {
    const batch = await db.guestbookEntry.findMany({
      where,
      select: guestbookExportSelect,
      orderBy: { id: "asc" },
      take: EXPORT_BATCH_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    rows.push(...batch);

    if (batch.length < EXPORT_BATCH_SIZE) break;
    cursorId = batch.at(-1)?.id;
    if (!cursorId) break;
  }

  rows.sort((a, b) => {
    const byCheckIn = b.checkInAt.getTime() - a.checkInAt.getTime();
    return byCheckIn !== 0 ? byCheckIn : a.id.localeCompare(b.id);
  });
  return rows;
}

function countBy(rows: GuestbookExportRow[], label: (row: GuestbookExportRow) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = label(row) || "Belum diisi";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"));
}

function styleSectionHeader(row: Row): void {
  row.font = { bold: true, color: { argb: WHITE } };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_INK } };
  });
}

function addSummarySection(sheet: Worksheet, title: string, entries: Array<[string, number]>): void {
  sheet.addRow([]);
  const header = sheet.addRow([title, "Jumlah"]);
  styleSectionHeader(header);
  if (entries.length === 0) {
    sheet.addRow(["Tidak ada data", 0]);
    return;
  }
  for (const [label, count] of entries) sheet.addRow([label, count]);
}

function buildSummarySheet(
  sheet: Worksheet,
  rows: GuestbookExportRow[],
  query: ExportQuery,
  exportedAt: Date,
): void {
  sheet.mergeCells("A1:D1");
  const title = sheet.getCell("A1");
  title.value = "Ringkasan Export Guestbook";
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_INK } };
  title.font = { bold: true, color: { argb: WHITE }, size: 16 };
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 32;

  sheet.addRow(["Total data", rows.length]);
  const exportedRow = sheet.addRow(["Waktu export", exportedAt]);
  exportedRow.getCell(2).numFmt = "dd mmmm yyyy hh:mm";
  sheet.addRow(["Periode check-in", query.from || query.to ? `${query.from ?? "Awal"} s.d. ${query.to ?? "Akhir"}` : "Semua tanggal"]);
  sheet.addRow(["Pencarian", query.search ?? "Tidak ada"]);
  sheet.addRow(["Filter venue", query.venueIds?.length ? `${query.venueIds.length} venue dipilih` : "Semua venue"]);
  sheet.addRow(["Filter host", query.hostId ? "Aktif" : "Semua host"]);
  sheet.addRow(["Filter kategori", query.categories?.map((value) => EVENT_CATEGORY_LABELS[value] ?? "Tanpa paket").join(", ") || "Semua kategori"]);
  sheet.addRow(["Filter status", query.statusIds?.length ? `${query.statusIds.length} status dipilih` : "Semua status"]);
  sheet.addRow(["Filter sumber", query.sourceOfInformationIds?.length ? `${query.sourceOfInformationIds.length} sumber dipilih` : "Semua sumber"]);
  sheet.addRow(["Filter festival", query.festivalIds?.length ? `${query.festivalIds.length} festival dipilih` : "Semua festival"]);

  for (let rowNumber = 2; rowNumber <= 10; rowNumber += 1) {
    sheet.getRow(rowNumber).getCell(1).font = { bold: true, color: { argb: BRAND_INK } };
  }

  addSummarySection(sheet, "Kategori Event", countBy(rows, eventCategoryLabel));
  addSummarySection(sheet, "Status Prospek", countBy(rows, (row) => row.prospectStatus?.name ?? "Belum ada status"));
  addSummarySection(sheet, "Sumber Informasi", countBy(rows, (row) => row.sourceOfInformation?.name ?? "Belum ada sumber"));
  addSummarySection(sheet, "Venue", countBy(rows, (row) => row.venue?.name ?? row.meetingLocation ?? "Belum ada venue"));
  addSummarySection(sheet, "Festival", countBy(rows, (row) => row.festival?.name ?? "Tanpa festival"));

  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 18 }, { width: 18 }];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.properties.defaultRowHeight = 20;
}

function setHyperlink(row: Row, columnNumber: number, url: string): void {
  if (!url) return;
  row.getCell(columnNumber).value = { text: "Buka link", hyperlink: url, tooltip: url };
  row.getCell(columnNumber).font = { color: { argb: BRAND_INK } };
}

function buildDataSheet(sheet: Worksheet, rows: GuestbookExportRow[]): void {
  const headerRow = sheet.addRow(DATA_HEADERS);
  headerRow.height = 32;
  headerRow.font = { bold: true, color: { argb: WHITE } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_INK } };
    cell.border = {
      bottom: { style: "medium", color: { argb: BRAND_GOLD } },
    };
  });

  rows.forEach((entry, index) => {
    const proofUrls = resolveProofUrls(entry.proofFiles);
    const categoryPrices = entry.package?.categoryPrices
      .map((price) => `${price.categoryName}: ${price.basePrice.toLocaleString("id-ID")}`)
      .join(" | ") ?? "";
    const row = sheet.addRow([
      index + 1,
      entry.id,
      entry.guestCode ?? "",
      entry.visitorName,
      entry.companyName ?? "",
      eventCategoryLabel(entry),
      entry.segment?.name ?? "",
      entry.phoneNumber ?? "",
      entry.email ?? "",
      entry.prospectStatus?.name ?? "",
      entry.sourceOfInformation?.name ?? "",
      entry.venue?.name ?? "",
      entry.meetingLocation ?? "",
      entry.host?.fullName ?? "",
      entry.sales?.fullName ?? "",
      entry.package?.packageName ?? "",
      entry.package ? EVENT_CATEGORY_LABELS[entry.package.category] ?? entry.package.category : "",
      entry.package?.pax ?? "",
      entry.package?.sellingPrice ?? "",
      entry.package?.margin ?? "",
      categoryPrices,
      entry.festival?.name ?? "",
      entry.checkInAt,
      entry.scheduledAt ?? "",
      entry.onlineMedium ? ONLINE_MEDIUM_LABELS[entry.onlineMedium] ?? entry.onlineMedium : "",
      entry.meetingUrl ?? "",
      entry.notes ?? "",
      entry.commitVisitDate ?? "",
      entry.commitPayDate ?? "",
      entry.bitrixContactId ?? "",
      entry.bitrixName ?? "",
      entry.bitrixSourceInfo ?? "",
      entry.bitrixAdsUrl ?? "",
      entry.confirmedGuestCount ?? "",
      entry.confirmedGuestCountAt ?? "",
      entry.actualGuestCount ?? "",
      entry.attendanceConfirmedAt ? "Hadir" : "Belum dikonfirmasi",
      entry.attendanceConfirmedAt ?? "",
      entry.attendanceConfirmedBy?.fullName ?? "",
      entry.createdBy?.fullName ?? "",
      entry.createdAt,
      entry.updatedAt,
      proofUrls.photo,
      proofUrls.chat,
      proofUrls.reschedule,
      proofUrls.lost,
    ]);

    row.alignment = { vertical: "top", wrapText: true };
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT_GRAY } };
      });
    }

    for (const columnNumber of [23, 24, 35, 38, 41, 42]) {
      row.getCell(columnNumber).numFmt = "dd mmmm yyyy hh:mm";
    }
    for (const columnNumber of [28, 29]) {
      row.getCell(columnNumber).numFmt = "dd mmmm yyyy";
    }
    row.getCell(19).numFmt = "#,##0";
    row.getCell(20).numFmt = "#,##0.00";

    setHyperlink(row, 26, entry.meetingUrl ?? "");
    setHyperlink(row, 33, entry.bitrixAdsUrl ?? "");
    setHyperlink(row, 43, proofUrls.photo);
    setHyperlink(row, 44, proofUrls.chat);
    setHyperlink(row, 45, proofUrls.reschedule);
    setHyperlink(row, 46, proofUrls.lost);
  });

  sheet.columns.forEach((column, index) => {
    column.width = DATA_COLUMN_WIDTHS[index] ?? 18;
  });
  sheet.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }];
  sheet.autoFilter = `A1:AT${Math.max(1, rows.length + 1)}`;
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
}

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-export:${session.user.id}`)) return rateLimitResponse();

  const query = parseExportQuery(new URL(req.url).searchParams);
  if (!query) {
    return Response.json({ error: "Filter export tidak valid." }, { status: 400 });
  }

  try {
    const scopeWhere = (await buildOwnerScopeWhere(
      session.user.profileId,
      session.user.dataScope,
      "salesId",
    )) as Prisma.GuestbookEntryWhereInput;
    const where: Prisma.GuestbookEntryWhereInput = {
      ...scopeWhere,
      ...buildGuestbookWhere({
        search: query.search,
        venueIds: query.venueIds,
        hostId: query.hostId,
        dateFrom: query.from,
        dateTo: query.to,
        categories: query.categories as GuestbookCategoryFilter[] | undefined,
        statusIds: query.statusIds,
        sourceOfInformationIds: query.sourceOfInformationIds,
        festivalIds: query.festivalIds,
      }),
    };

    const total = await db.guestbookEntry.count({ where });
    if (total > EXCEL_MAX_DATA_ROWS) {
      return Response.json(
        { error: "Data terlalu banyak untuk satu file Excel. Gunakan filter untuk memperkecil data." },
        { status: 422 },
      );
    }

    const rows = await fetchAllGuestbookRows(where);
    const exportedAt = new Date();
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Swasana";
    workbook.lastModifiedBy = "Swasana";
    workbook.created = exportedAt;
    workbook.modified = exportedAt;

    buildSummarySheet(workbook.addWorksheet("Ringkasan", { properties: { tabColor: { argb: BRAND_GOLD } } }), rows, query, exportedAt);
    buildDataSheet(workbook.addWorksheet("Data Guestbook", { properties: { tabColor: { argb: BRAND_INK } } }), rows);

    const buffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer = buffer instanceof ArrayBuffer
      ? buffer
      : (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    const stamp = exportedAt.toISOString().split("T")[0];

    return new Response(arrayBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Guestbook_Lengkap_${stamp}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Exported-Rows": String(rows.length),
      },
    });
  } catch (error) {
    console.error("[GUESTBOOK] Failed to export Excel:", error);
    return Response.json({ error: "Gagal mengekspor data guestbook." }, { status: 500 });
  }
}
