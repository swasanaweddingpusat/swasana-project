import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

// ─── GET /api/procurement/export ─────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "excel" ? "excel" : "csv";
  const venueId = searchParams.get("venueId") ?? undefined;
  const division = searchParams.get("division") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  try {
    const items = await db.procurementItem.findMany({
      where: {
        ...(venueId && { venueId }),
        ...(division && {
          division: division as "HR" | "OPERATIONAL" | "IT" | "FINANCE" | "MICE",
        }),
        ...(status && {
          status: status as "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED",
        }),
        ...((dateFrom ?? dateTo)
          ? {
              tanggalPermintaan: {
                ...(dateFrom && { gte: new Date(dateFrom) }),
                ...(dateTo && { lte: new Date(dateTo) }),
              },
            }
          : {}),
      },
      include: {
        venue: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const csvHeaders = [
      "Tanggal",
      "Venue",
      "Nama Barang",
      "Jumlah",
      "Sisa",
      "PIC",
      "Total",
      "Status",
      "Divisi",
      "Keterangan",
      "Dibuat Oleh",
      "Disetujui Oleh",
    ];

    const rows = items.map((item) => [
      item.tanggalPermintaan.toISOString().split("T")[0],
      item.venue.name,
      item.namaBarang,
      item.jumlahBarang.toString(),
      item.sisaBarang.toString(),
      item.picPenerima,
      item.total !== null ? item.total.toString() : "",
      item.status,
      item.division ?? "",
      item.keterangan ?? "",
      item.createdBy.fullName ?? "",
      item.approvedBy?.fullName ?? "",
    ]);

    if (format === "csv") {
      const csv = [csvHeaders, ...rows]
        .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="procurement-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Excel: attempt dynamic import — exceljs is an optional dependency
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error exceljs is optional and may not be installed
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Pengadaan Barang");
      sheet.addRow(csvHeaders);
      rows.forEach((row) => sheet.addRow(row));
      const buffer = await workbook.xlsx.writeBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="procurement-${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      });
    } catch {
      return Response.json(
        { error: "Export Excel tidak tersedia, gunakan format CSV" },
        { status: 501 }
      );
    }
  } catch {
    return Response.json({ error: "Gagal mengekspor data pengadaan" }, { status: 500 });
  }
}
