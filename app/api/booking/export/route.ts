import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getBookingsForExport, type BookingExportFilters } from "@/lib/queries/bookings";
import type { DataScope } from "@/types/user";

const STATUS_LABEL: Record<string, string> = {
  Pending: "Pending",
  Confirmed: "Confirmed",
  Uploaded: "Uploaded",
  Rejected: "Rejected",
  Canceled: "Canceled",
  Lost: "Lost",
};

/** Format a Date as dd/MM/yyyy in WIB (UTC+7) for the report cell. */
function fmtDate(value: Date | null): string {
  if (!value) return "";
  const wib = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = wib.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── GET /api/booking/export — Excel export of wedding bookings ───────────────

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!apiLimiter.check(`booking-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const filters: BookingExportFilters = {
    dealingFrom: searchParams.get("dealingFrom") ?? undefined,
    dealingTo: searchParams.get("dealingTo") ?? undefined,
  };

  try {
    const profileId = session.user.profileId ?? undefined;
    let dataScope: DataScope = "own";
    if (profileId) {
      const profile = await db.profile.findUnique({
        where: { id: profileId },
        select: { dataScope: true },
      });
      if (profile) dataScope = profile.dataScope as DataScope;
    }

    const rows = await getBookingsForExport(profileId, dataScope, filters);

    const headers = [
      "NAMA CLIENT",
      "TANGGAL DEALING",
      "TANGGAL EVENT",
      "NAMA MARKETING",
      "SUMBER DEALING",
      "STATUS",
    ];

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Booking Wedding");

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    rows.forEach((r) => {
      sheet.addRow([
        r.clientName,
        fmtDate(r.dealingDate),
        fmtDate(r.eventDate),
        r.marketingName,
        r.dealingSource,
        STATUS_LABEL[r.status] ?? r.status,
      ]);
    });

    sheet.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const arrayBuffer =
      buffer instanceof ArrayBuffer
        ? buffer
        : (buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ) as ArrayBuffer);

    const stamp = new Date().toISOString().split("T")[0];
    return new Response(arrayBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="booking-wedding-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[BOOKING] Failed to export Excel:", err);
    return Response.json({ error: "Gagal mengekspor data booking." }, { status: 500 });
  }
}
