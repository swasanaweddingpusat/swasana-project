import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { Prisma } from "@prisma/client";

// Mirrors GuestbookClient.tsx / GuestbookDetailDrawer.tsx — keep labels in sync.
const VISIT_STATUS_LABELS: Record<string, string> = {
  deal: "Deal",
  in_progress: "In Progress",
  pending: "Pending",
  to_be_discuss: "To Be Discuss",
  lost: "Lost",
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  client_visit: "Kunjungan Client",
  online_meeting: "Online Meeting",
  jemput_bola: "Jemput Bola",
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

const guestbookExportSelect = {
  visitorName: true,
  guestCode: true,
  phoneNumber: true,
  email: true,
  interactionType: true,
  visitStatus: true,
  checkInAt: true,
  checkOutAt: true,
  commitVisitDate: true,
  commitPayDate: true,
  createdAt: true,
  host: { select: { fullName: true } },
  venue: { select: { name: true } },
  sourceOfInformation: { select: { name: true } },
  package: { select: { packageName: true } },
  createdBy: { select: { fullName: true } },
} satisfies Prisma.GuestbookEntrySelect;

// ─── GET /api/guestbook/export — Excel export of guestbook entries ────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "guestbook",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`guestbook-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const scopeWhere = (await buildOwnerScopeWhere(
      session.user.profileId,
      session.user.dataScope,
      "salesId",
    )) as Prisma.GuestbookEntryWhereInput;

    const where: Prisma.GuestbookEntryWhereInput = { ...scopeWhere };
    if (from || to) {
      where.checkInAt = {
        ...(from && { gte: new Date(`${from}T00:00:00`) }),
        ...(to && { lte: new Date(`${to}T23:59:59.999`) }),
      };
    }

    const rows = await db.guestbookEntry.findMany({
      where,
      select: guestbookExportSelect,
      orderBy: { checkInAt: "desc" },
      take: 5000,
    });

    const headers = [
      "Nama Tamu",
      "Guest Code",
      "Telepon",
      "Email",
      "Tipe Interaksi",
      "Venue",
      "Bertemu",
      "Sumber",
      "Paket",
      "Visit Status",
      "Check-in",
      "Check-out",
      "Tanggal Commit Visit",
      "Tanggal Commit Bayar",
      "Dicatat oleh",
      "Tanggal Dibuat",
    ];

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guestbook");

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4159" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });

    rows.forEach((r) => {
      sheet.addRow([
        r.visitorName,
        r.guestCode ?? "",
        r.phoneNumber ?? "",
        r.email ?? "",
        r.interactionType ? INTERACTION_TYPE_LABELS[r.interactionType] ?? r.interactionType : "",
        r.venue?.name ?? "",
        r.host?.fullName ?? "",
        r.sourceOfInformation?.name ?? "",
        r.package?.packageName ?? "",
        r.visitStatus ? VISIT_STATUS_LABELS[r.visitStatus] ?? r.visitStatus : "",
        fmtDateTime(r.checkInAt),
        fmtDateTime(r.checkOutAt),
        fmtDate(r.commitVisitDate),
        fmtDate(r.commitPayDate),
        r.createdBy?.fullName ?? "",
        fmtDateTime(r.createdAt),
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
        "Content-Disposition": `attachment; filename="Guestbook_${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[GUESTBOOK] Failed to export Excel:", err);
    return Response.json({ error: "Gagal mengekspor data guestbook." }, { status: 500 });
  }
}
