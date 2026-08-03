import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";

function toSafeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value);
}

// ─── GET /api/procurement/export ─────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({
    module: "procurement",
    action: "view",
  });
  if (response) return response;
  if (!apiLimiter.check(`procurement-export:${session.user.id}`)) return rateLimitResponse();

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") as "csv" | "excel" | "pdf") ?? "csv";
  const venueId = searchParams.get("venueId") ?? undefined;
  const division = searchParams.get("division") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
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
        ...((search)
          ? {
              OR: [
                { namaBarang: { contains: search, mode: "insensitive" as const } },
                { picPenerima: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...((dateFrom ?? dateTo)
          ? {
              tanggalPermintaan: {
                ...(dateFrom && { gte: new Date(dateFrom) }),
                ...(dateTo && { lte: new Date(dateTo) }),
              },
            }
          : {}),
      },
      select: {
        tanggalPermintaan: true,
        namaBarang: true,
        jumlahBarang: true,
        sisaBarang: true,
        picPenerima: true,
        harga: true,
        pettyCash: true,
        total: true,
        status: true,
        division: true,
        penggunaan: true,
        keterangan: true,
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
      "Harga",
      "Petty Cash",
      "Total",
      "Status",
      "Divisi",
      "Penggunaan",
      "Keterangan",
      "Dibuat Oleh",
      "Disetujui Oleh",
    ];
 
    const rows = items.map((item) => [
      toSafeText(item.tanggalPermintaan),
      toSafeText(item.venue?.name),
      toSafeText(item.namaBarang),
      toSafeText(item.jumlahBarang),
      toSafeText(item.sisaBarang),
      toSafeText(item.picPenerima),
      toSafeText(item.harga != null && Number(item.harga) > 0 ? item.harga : ""),
      toSafeText(item.pettyCash != null && Number(item.pettyCash) > 0 ? item.pettyCash : ""),
      toSafeText(item.total ?? ""),
      toSafeText(item.status),
      toSafeText(item.division ?? ""),
      toSafeText(item.penggunaan ?? ""),
      toSafeText(item.keterangan ?? ""),
      toSafeText(item.createdBy?.fullName ?? ""),
      toSafeText(item.approvedBy?.fullName ?? ""),
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

    if (format === "excel") {
      try {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Pengadaan Barang");
        sheet.addRow(csvHeaders);
        rows.forEach((row) => sheet.addRow(row));
        const buffer = await workbook.xlsx.writeBuffer();
        const arrayBuffer = buffer instanceof ArrayBuffer
          ? buffer
          : (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

        return new Response(arrayBuffer as unknown as BodyInit, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="procurement-${new Date().toISOString().split("T")[0]}.xlsx"`,
          },
        });
      } catch (err) {
        console.error("[PROCUREMENT] Failed to export Excel:", err);
        return Response.json(
          { error: "Export Excel tidak tersedia, gunakan format CSV" },
          { status: 501 }
        );
      }
    }

    if (format === "pdf") {
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 24;
        const colWidths = [42, 34, 60, 30, 30, 42, 42, 42, 42, 38, 34, 55, 70, 55, 55];
        const tableTop = 70;
        const tableLeft = margin;
        const tableWidth = pageWidth - margin * 2;
        const headerHeight = 18;
        let y = tableTop + headerHeight + 4;

        doc.setFillColor(15, 65, 89);
        doc.rect(margin, 30, pageWidth - margin * 2, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Laporan Pengadaan Barang", margin + 8, 46);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID")}`, pageWidth - margin - 110, 46);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.rect(margin, 60, pageWidth - margin * 2, 0);

        doc.setFillColor(240, 245, 248);
        doc.rect(tableLeft, tableTop, tableWidth, headerHeight, "F");
        doc.setDrawColor(220, 225, 230);
        doc.rect(tableLeft, tableTop, tableWidth, headerHeight, "S");

        let x = tableLeft;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        csvHeaders.forEach((header, index) => {
          const width = colWidths[index] ?? 60;
          doc.text(header, x + 3, tableTop + 11);
          x += width;
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);

        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          const cellLines = row.map((value, cellIndex) => {
            const width = colWidths[cellIndex] ?? 60;
            return doc.splitTextToSize(toSafeText(value), width - 6);
          });
          const maxLines = Math.max(...cellLines.map((lines) => lines.length));
          const currentHeight = Math.max(14, maxLines * 3.8 + 4);

          if (y + currentHeight > pageHeight - margin) {
            doc.addPage();
            y = tableTop + headerHeight + 4;
            doc.setFillColor(240, 245, 248);
            doc.rect(tableLeft, tableTop, tableWidth, headerHeight, "F");
            doc.setDrawColor(220, 225, 230);
            doc.rect(tableLeft, tableTop, tableWidth, headerHeight, "S");
            x = tableLeft;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            csvHeaders.forEach((header, headerIndex) => {
              const width = colWidths[headerIndex] ?? 60;
              doc.text(header, x + 3, tableTop + 11);
              x += width;
            });
            y = tableTop + headerHeight + 4;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
          }

          doc.setDrawColor(235, 238, 242);
          doc.rect(tableLeft, y - 2, tableWidth, currentHeight, "S");
          x = tableLeft;
          row.forEach((value, cellIndex) => {
            const width = colWidths[cellIndex] ?? 60;
            const lines = cellLines[cellIndex] ?? [];
            const textY = y + 2;
            doc.text(lines, x + 3, textY);
            x += width;
          });
          y += currentHeight + 2;
        }

        const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;

        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="procurement-${new Date().toISOString().split("T")[0]}.pdf"`,
          },
        });
      } catch (err) {
        console.error("[PROCUREMENT] Failed to export PDF:", err);
        return Response.json(
          { error: "Export PDF tidak tersedia saat ini." },
          { status: 501 }
        );
      }
    }

    return Response.json({ error: "Format ekspor tidak didukung." }, { status: 400 });
  } catch (err) {
    console.error("[PROCUREMENT] Failed to export items:", err);
    return Response.json({ error: "Gagal mengekspor data pengadaan" }, { status: 500 });
  }
}
