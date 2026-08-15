import type { jsPDF } from "jspdf";
import type { Workbook, Worksheet } from "exceljs";

interface Bucket {
  key: string;
  label: string;
  count: number;
}

interface AdBucket {
  key: string;
  url: string;
  count: number;
}

interface SalesBucket {
  key: string;
  label: string;
  count: number;
  getback: number;
}

interface OverviewData {
  range: { from: string; to: string };
  total: number;
  withVenue: number;
  organik: number;
  fromAds: number;
  spamPrank: number;
  sources: Bucket[];
  ads: AdBucket[];
  sales: SalesBucket[];
  venues: Bucket[];
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

export async function exportBitrixOverviewExcel(data: OverviewData): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb: Workbook = new ExcelJS.Workbook();

  // 1. Overview sheet — metrik utama.
  const overview = wb.addWorksheet("Overview");
  buildOverviewSheet(overview, data);

  // 2. Sumber Database sheet.
  const sources = wb.addWorksheet("Sumber Database");
  buildBucketSheet(sources, "Sumber Database", data.sources, ["Sumber", "Jumlah"]);

  // 3. Venue sheet.
  const venues = wb.addWorksheet("Venue");
  buildBucketSheet(venues, "Venue", data.venues, ["Venue", "Jumlah"]);

  // 4. Database Sales sheet.
  const sales = wb.addWorksheet("Database Sales");
  buildSalesSheet(sales, data.sales);

  // 5. Sumber Iklan sheet.
  const ads = wb.addWorksheet("Sumber Iklan");
  buildAdsSheet(ads, data.ads);

  const buf = await wb.xlsx.writeBuffer();
  const ab =
    buf instanceof ArrayBuffer
      ? buf
      : (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  await downloadBlob(
    new Blob([ab as unknown as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `bitrix-overview-${stamp()}.xlsx`,
  );
}

export async function exportBitrixOverviewPdf(data: OverviewData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Ringkasan CRM Bitrix24", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Periode: ${data.range.from} s/d ${data.range.to}`, margin, y);
  y += 20;

  doc.setTextColor(0);
  doc.setFontSize(9);
  const metrics: [string, number][] = [
    ["Database Venue", data.withVenue],
    ["Total Transaksi", data.total],
    ["Dari Iklan", data.fromAds],
    ["Organik", data.organik],
    ["Spam/Prank", data.spamPrank],
  ];
  for (const [label, value] of metrics) {
    doc.setFont("helvetica", "normal");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(String(value ?? 0), pageWidth - margin, y, { align: "right" });
    y += 14;
  }

  y += 8;
  y = drawPdfBucketSection(doc, "Sumber Database", data.sources, y, margin, pageWidth, pageHeight);
  y = drawPdfBucketSection(doc, "Venue", data.venues, y, margin, pageWidth, pageHeight);
  y = drawPdfSalesSection(doc, data.sales, y, margin, pageWidth, pageHeight);
  drawPdfAdsSection(doc, data.ads, y, margin, pageWidth, pageHeight);

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  await downloadBlob(new Blob([ab], { type: "application/pdf" }), `bitrix-overview-${stamp()}.pdf`);
}

function buildOverviewSheet(ws: Worksheet, data: OverviewData): void {
  const title = ws.addRow(["Ringkasan CRM Bitrix24"]);
  title.font = { bold: true, size: 14 };
  const range = ws.addRow([`Periode: ${data.range.from} s/d ${data.range.to}`]);
  range.font = { color: { argb: "FF6B7280" } };

  ws.addRow([]);
  ws.addRow(["Metrik", "Jumlah"]);
  const metrics: [string, number][] = [
    ["Database Venue", data.withVenue],
    ["Total Transaksi", data.total],
    ["Dari Iklan", data.fromAds],
    ["Organik", data.organik],
    ["Spam/Prank", data.spamPrank],
  ];
  for (const [label, value] of metrics) {
    ws.addRow([label, value]);
  }
  fitColumns(ws);
}

function buildBucketSheet(ws: Worksheet, title: string, buckets: Bucket[] | undefined, headers: [string, string]): void {
  const heading = ws.addRow([title]);
  heading.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(headers);
  for (const b of buckets ?? []) {
    ws.addRow([b.label, b.count]);
  }
  fitColumns(ws);
}

function buildSalesSheet(ws: Worksheet, buckets: SalesBucket[] | undefined): void {
  const heading = ws.addRow(["Database Sales"]);
  heading.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(["Nama", "Jumlah", "Getback"]);
  for (const b of buckets ?? []) {
    ws.addRow([b.label, b.count, b.getback]);
  }
  fitColumns(ws);
}

function buildAdsSheet(ws: Worksheet, buckets: AdBucket[] | undefined): void {
  const heading = ws.addRow(["Sumber Iklan"]);
  heading.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(["URL", "Jumlah"]);
  for (const b of buckets ?? []) {
    ws.addRow([b.url, b.count]);
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

function drawPdfBucketSection(
  doc: jsPDF,
  title: string,
  buckets: Bucket[] | undefined,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (y + 40 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const b of buckets ?? []) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(b.label, margin, y);
    doc.text(String(b.count), pageWidth - margin, y, { align: "right" });
    y += 13;
  }
  y += 10;
  return y;
}

function drawPdfSalesSection(
  doc: jsPDF,
  buckets: SalesBucket[] | undefined,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (y + 40 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Database Sales", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const b of buckets ?? []) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(b.label, margin, y);
    doc.text(`${b.count}${b.getback > 0 ? ` · ${b.getback} getback` : ""}`, pageWidth - margin, y, { align: "right" });
    y += 13;
  }
  y += 10;
  return y;
}

function drawPdfAdsSection(
  doc: jsPDF,
  buckets: AdBucket[] | undefined,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
): void {
  if (y + 40 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Sumber Iklan", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const b of buckets ?? []) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    const lines = doc.splitTextToSize(b.url, pageWidth - margin * 2 - 60) as string[];
    doc.text(lines, margin, y);
    doc.text(String(b.count), pageWidth - margin, y, { align: "right" });
    y += Math.max(13, lines.length * 11);
  }
}
