import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getDailyActivitiesForExport } from "@/lib/queries/daily-activity";
import { dailyActivityExportFilterSchema } from "@/lib/validations/daily-activity";
import type { ProgressStatus } from "@/lib/validations/daily-activity";

// Mirrors PROGRESS_STATUS_LABELS in daily-activity/_components/progress-status.tsx
// — keep labels in sync.
const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  COLD: "Cold",
  WARM: "Warm",
  HOT: "Hot",
  FREEZE: "Freeze",
  DEAL: "Deal",
  LOST: "Lost",
};

/** Format a Date as "d MMMM yyyy" in id-ID — for date-only cells. */
function fmtDate(value: Date | null): string {
  if (!value) return "";
  return value.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Format a Date as "d MMMM yyyy HH:mm" in id-ID — for date-time cells. */
function fmtDateTime(value: Date | null): string {
  if (!value) return "";
  return value.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── GET /api/daily-activities/export — Excel export of daily activities ──────
// Mirrors the active table filter — never a raw/unfiltered dump.

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "daily-activity",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`daily-activity-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const raw = {
    search: searchParams.get("search") ?? undefined,
    progressStatus: searchParams.get("progressStatus") ?? undefined,
    segmentId: searchParams.get("segmentId") ?? undefined,
    salesId: searchParams.get("salesId") ?? undefined,
    activityDateFrom: searchParams.get("activityDateFrom") ?? undefined,
    activityDateTo: searchParams.get("activityDateTo") ?? undefined,
    siteVisitFrom: searchParams.get("siteVisitFrom") ?? undefined,
    siteVisitTo: searchParams.get("siteVisitTo") ?? undefined,
  };

  const parsed = dailyActivityExportFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    const caller = { profileId: session.user.profileId, dataScope: session.user.dataScope };
    const rows = await getDailyActivitiesForExport(parsed.data, caller);

    const headers = [
      "Tanggal Aktivitas",
      "Perusahaan",
      "Kontak",
      "No. HP",
      "Email",
      "Lokasi",
      "Sales",
      "Segment",
      "Sumber Informasi",
      "Detail Sumber",
      "Bitrix ID",
      "Progress",
      "Tanggal Site Visit",
      "Milestone",
      "Catatan",
      "Dibuat",
      "Diperbarui",
    ];

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Daily Activity");

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    rows.forEach((r) => {
      sheet.addRow([
        fmtDate(r.activityDate),
        r.companyName ?? "",
        r.contactName ?? "",
        r.phoneNumber ?? "",
        r.email ?? "",
        r.location ?? "",
        r.sales.fullName,
        r.segment.name,
        r.sourceOfInformation?.name ?? "",
        r.sourceOfInformationDetail ?? "",
        r.bitrixId ?? "",
        PROGRESS_STATUS_LABELS[r.progressStatus] ?? r.progressStatus,
        fmtDate(r.siteVisitAt),
        r.milestone,
        r.notes ?? "",
        fmtDateTime(r.createdAt),
        fmtDateTime(r.updatedAt),
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
        "Content-Disposition": `attachment; filename="daily-activity-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[DAILY-ACTIVITY] Failed to export Excel:", err);
    return Response.json({ error: "Gagal mengekspor data daily activity." }, { status: 500 });
  }
}
