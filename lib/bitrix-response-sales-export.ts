import type { jsPDF } from "jspdf";
import type { Workbook, Worksheet } from "exceljs";

interface ResponseSalesRow {
  userId: string;
  name: string;
  samples: number;
  avgSeconds: number;
  seconds: number;
  minutes: number;
  hours: string;
}

interface GrandTotal {
  seconds: number;
  minutes: number;
  hours: string;
  samples: number;
}

interface ResponseSalesExportData {
  from: string;
  to: string;
  totalSessions: number;
  rows: ResponseSalesRow[];
  grandTotal: GrandTotal | null;
  salesQuery?: string;
}

function stamp(): string {
  return new Date().toISOString().split("T")[0];
}

async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportResponseSalesExcel(data: ResponseSalesExportData): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb: Workbook = new ExcelJS.Workbook();

  const overview = wb.addWorksheet("Overview");
  buildOverviewSheet(overview, data);

  const rows = wb.addWorksheet("Response Sales");
  buildRowsSheet(rows, data.rows);

  const buf = await wb.xlsx.writeBuffer();
  const ab =
    buf instanceof ArrayBuffer
      ? buf
      : (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  await downloadBlob(
    new Blob([ab as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `bitrix-response-sales-${stamp()}.xlsx`,
  );
}

export async function exportResponseSalesPdf(data: ResponseSalesExportData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Response Sales Bitrix24", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Periode: ${data.from} s/d ${data.to}${data.salesQuery ? ` · Sales: ${data.salesQuery}` : ""}`, margin, y);
  y += 20;

  doc.setTextColor(0);
  doc.setFontSize(9);
  const summary: [string, string][] = [
    ["Total Percakapan", String(data.totalSessions)],
    ["Total Respons", data.grandTotal ? String(data.grandTotal.samples) : "0"],
    ["Rata-rata Detik", data.grandTotal ? String(data.grandTotal.seconds) : "0"],
    ["Rata-rata Menit", data.grandTotal ? String(data.grandTotal.minutes) : "0"],
    ["Rata-rata Jam", data.grandTotal?.hours ?? "0:00:00"],
  ];
  for (const [label, value] of summary) {
    doc.setFont("helvetica", "normal");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth - margin, y, { align: "right" });
    y += 14;
  }

  y += 12;
  const colWidths = [160, 70, 70, 70, 70];
  const headers = ["Nama", "Detik", "Menit", "Jam", "Percakapan"];
  const tableLeft = margin;
  const headerHeight = 18;

  if (y + headerHeight > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFillColor(15, 65, 89);
  doc.rect(tableLeft, y, pageWidth - margin * 2, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = tableLeft;
  headers.forEach((h, i) => {
    doc.text(h, x + 4, y + 12);
    x += colWidths[i];
  });
  y += headerHeight + 4;

  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const r of data.rows) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    const cells = [r.name, String(r.seconds), String(r.minutes), r.hours, String(r.samples)];
    x = tableLeft;
    cells.forEach((c, i) => {
      const lines = doc.splitTextToSize(c, colWidths[i] - 8) as string[];
      doc.text(lines, x + 4, y + 10);
      x += colWidths[i];
    });
    y += 16;
  }

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  await downloadBlob(new Blob([ab], { type: "application/pdf" }), `bitrix-response-sales-${stamp()}.pdf`);
}

function buildOverviewSheet(ws: Worksheet, data: ResponseSalesExportData): void {
  const title = ws.addRow(["Response Sales Bitrix24"]);
  title.font = { bold: true, size: 14 };
  const range = ws.addRow([
    `Periode: ${data.from} s/d ${data.to}${data.salesQuery ? ` · Sales: ${data.salesQuery}` : ""}`,
  ]);
  range.font = { color: { argb: "FF6B7280" } };

  ws.addRow([]);
  ws.addRow(["Metrik", "Jumlah"]);
  const summary: [string, string | number][] = [
    ["Total Percakapan", data.totalSessions],
    ["Total Respons", data.grandTotal?.samples ?? 0],
    ["Rata-rata Detik", data.grandTotal?.seconds ?? 0],
    ["Rata-rata Menit", data.grandTotal?.minutes ?? 0],
    ["Rata-rata Jam", data.grandTotal?.hours ?? "0:00:00"],
  ];
  for (const [label, value] of summary) {
    ws.addRow([label, value]);
  }
  fitColumns(ws);
}

function buildRowsSheet(ws: Worksheet, rows: ResponseSalesRow[]): void {
  const title = ws.addRow(["Response Sales"]);
  title.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(["Nama", "Detik", "Menit", "Jam", "Percakapan"]);
  for (const r of rows) {
    ws.addRow([r.name, r.seconds, r.minutes, r.hours, r.samples]);
  }
  fitColumns(ws);
}

function fitColumns(ws: Worksheet): void {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}
