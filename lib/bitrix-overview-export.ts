import type { jsPDF } from "jspdf";
import type { Workbook, Worksheet } from "exceljs";
import {
  buildSalesStatusBreakdown,
  buildStatusClientBreakdown,
  buildNotDatabaseBreakdown,
  type SalesStatusGroup,
} from "@/lib/bitrix-overview-status";

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
  kantor: number;
  mandiri: number;
}

interface DealForStatus {
  salesId: string;
  salesName: string;
  stageLabel: string;
  hasVenue: boolean;
  issueLabel: string;
}

interface OverviewData {
  range: { from: string; to: string };
  total: number;
  kantor: number;
  mandiri: number;
  withVenue: number;
  organik: number;
  fromAds: number;
  spamPrank: number;
  sources: Bucket[];
  ads: AdBucket[];
  sales: SalesBucket[];
  venues: Bucket[];
  deals: DealForStatus[];
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

  // 5. Komposisi Tahapan sheet — overall stage/status composition.
  const statusClient = buildStatusClientBreakdown(data.deals);
  const statusSheet = wb.addWorksheet("Komposisi Tahapan");
  buildBucketSheet(statusSheet, "Komposisi Tahapan", statusClient, ["Status", "Jumlah"]);

  // 6. Detail Status per Sales sheet — per-sales breakdown of stage/status.
  const salesStatus = buildSalesStatusBreakdown(data.deals);
  const salesStatusSheet = wb.addWorksheet("Detail Status per Sales");
  buildSalesStatusSheet(salesStatusSheet, salesStatus);

  // 7. Tidak Jadi Database sheet — per-sales breakdown of deals that did NOT
  // become a database entry (!hasVenue), by issue label.
  const notDatabase = buildNotDatabaseBreakdown(data.deals);
  const notDatabaseSheet = wb.addWorksheet("Tidak Jadi Database");
  buildSalesStatusSheet(notDatabaseSheet, notDatabase, "Detail Data Tidak Jadi Database per Sales");

  // 8. Sumber Iklan sheet.
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

// Identifies one exportable section of the Overview page. Kept as a closed
// union (not matched against the on-screen title string) so CardShell call
// sites are explicit about which data feeds their "Download PDF" button.
export type BitrixOverviewSection =
  | "sources"
  | "venues"
  | "sales"
  | "statusClient"
  | "salesStatus"
  | "notDatabase"
  | "ads";

/**
 * Gambar diagram batang vertikal memakai primitif jsPDF (rect + text), meniru
 * kartu Status Client di layar.
 *
 * Sengaja TIDAK merasterisasi DOM: selain hasilnya tetap tajam karena vektor,
 * cara ini kebal terhadap kegagalan html2canvas membaca warna oklch/color-mix
 * milik Tailwind v4.
 *
 * Mengembalikan posisi Y setelah diagram, mengikuti pola drawPdf*Section lain.
 */
function drawPdfBarChart(
  doc: jsPDF,
  title: string,
  buckets: Bucket[] | undefined,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const rows = (buckets ?? []).filter((b) => b.count > 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, y);
  y += 18;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Tidak ada data.", margin, y);
    return y + 16;
  }

  // Tinggi area plot dibatasi agar diagram + label miring tetap muat pada satu
  // halaman bersama judul dan periode di atasnya.
  const chartWidth = pageWidth - margin * 2;
  const plotHeight = Math.min(220, pageHeight - y - margin - 90);
  const baseline = y + plotHeight;
  const maxCount = Math.max(...rows.map((b) => b.count));

  // Lebar batang dihitung dari jumlah kategori; celah 30% dari slot.
  const slot = chartWidth / rows.length;
  const barWidth = Math.max(6, Math.min(34, slot * 0.7));

  // Sumbu Y: empat garis bantu horizontal beserta nilainya.
  doc.setFontSize(7);
  doc.setDrawColor(224);
  doc.setLineWidth(0.5);
  for (let i = 0; i <= 4; i++) {
    const gy = baseline - (plotHeight * i) / 4;
    const value = Math.round((maxCount * i) / 4);
    doc.setTextColor(140);
    doc.text(value.toLocaleString("id-ID"), margin - 4, gy + 2, { align: "right" });
    doc.line(margin, gy, margin + chartWidth, gy);
  }

  // Batang + nilai di atasnya + label kategori miring 45° di bawah baseline.
  rows.forEach((b, i) => {
    const barHeight = maxCount > 0 ? (b.count / maxCount) * plotHeight : 0;
    const cx = margin + slot * i + slot / 2;
    const bx = cx - barWidth / 2;

    doc.setFillColor(15, 65, 89); // brand ink — samakan dengan warna batang di layar
    doc.rect(bx, baseline - barHeight, barWidth, barHeight, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(40);
    doc.text(b.count.toLocaleString("id-ID"), cx, baseline - barHeight - 4, { align: "center" });

    // Label dipotong supaya tidak saling tindih saat kategorinya banyak.
    const label = b.label.length > 18 ? `${b.label.slice(0, 17)}…` : b.label;
    doc.setTextColor(90);
    doc.text(label, cx, baseline + 8, { align: "right", angle: 45 });
  });

  doc.setTextColor(0);
  return baseline + 70;
}

const SECTION_TITLES: Record<BitrixOverviewSection, string> = {
  sources: "Sumber Database",
  venues: "Venue",
  sales: "Database Sales",
  statusClient: "Status Client",
  salesStatus: "Detail Status Database per Sales",
  notDatabase: "Detail Data Tidak Jadi Database per Sales",
  ads: "Sumber Iklan",
};

/**
 * Per-section PDF export used by the "Download PDF" button on each Overview
 * card. Draws directly from `data` with jsPDF — same drawPdf*Section helpers
 * as `exportBitrixOverviewPdf` — so it can never hit the html2canvas
 * "unsupported color function" crash that DOM rasterization (the old
 * the old DOM-rasterization module was prone to.
 */
export async function exportBitrixOverviewSectionPdf(
  section: BitrixOverviewSection,
  data: OverviewData,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  // Section berdiagram dicetak melintang: 13+ kategori pada halaman potret
  // membuat batangnya terlalu rapat dan labelnya bertumpuk.
  const isChartSection = section === "statusClient";
  const doc = new jsPDF({
    orientation: isChartSection ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Periode: ${data.range.from} s/d ${data.range.to}`, margin, y);
  y += 20;
  doc.setTextColor(0);

  switch (section) {
    case "sources":
      drawPdfBucketSection(doc, SECTION_TITLES.sources, data.sources, y, margin, pageWidth, pageHeight);
      break;
    case "venues":
      drawPdfBucketSection(doc, SECTION_TITLES.venues, data.venues, y, margin, pageWidth, pageHeight);
      break;
    case "sales":
      drawPdfSalesSection(doc, data.sales, y, margin, pageWidth, pageHeight);
      break;
    case "statusClient": {
      // Status Client tampil sebagai diagram batang di layar, jadi PDF-nya juga
      // digambar sebagai diagram — lalu disusul rinciannya sebagai teks agar
      // angka pastinya tetap terbaca.
      const statusClient = buildStatusClientBreakdown(data.deals);
      const afterChart = drawPdfBarChart(
        doc,
        SECTION_TITLES.statusClient,
        statusClient,
        y,
        margin,
        pageWidth,
        pageHeight,
      );
      drawPdfBucketSection(doc, "Rincian", statusClient, afterChart, margin, pageWidth, pageHeight);
      break;
    }
    case "salesStatus": {
      const salesStatus = buildSalesStatusBreakdown(data.deals);
      drawPdfSalesStatusSection(doc, salesStatus, y, margin, pageWidth, pageHeight, SECTION_TITLES.salesStatus);
      break;
    }
    case "notDatabase": {
      const notDatabase = buildNotDatabaseBreakdown(data.deals);
      drawPdfSalesStatusSection(doc, notDatabase, y, margin, pageWidth, pageHeight, SECTION_TITLES.notDatabase);
      break;
    }
    case "ads":
      drawPdfAdsSection(doc, data.ads, y, margin, pageWidth, pageHeight);
      break;
  }

  const ab = doc.output("arraybuffer") as ArrayBuffer;
  await downloadBlob(new Blob([ab], { type: "application/pdf" }), `bitrix-${section}-${stamp()}.pdf`);
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
    ["Database Kantor", data.kantor],
    ["Database Mandiri", data.mandiri],
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
  const statusClient = buildStatusClientBreakdown(data.deals);
  y = drawPdfBucketSection(doc, "Komposisi Tahapan", statusClient, y, margin, pageWidth, pageHeight);
  const salesStatus = buildSalesStatusBreakdown(data.deals);
  y = drawPdfSalesStatusSection(doc, salesStatus, y, margin, pageWidth, pageHeight);
  const notDatabase = buildNotDatabaseBreakdown(data.deals);
  y = drawPdfSalesStatusSection(
    doc,
    notDatabase,
    y,
    margin,
    pageWidth,
    pageHeight,
    "Detail Data Tidak Jadi Database per Sales",
  );
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
    ["Database Kantor", data.kantor],
    ["Database Mandiri", data.mandiri],
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
  ws.addRow(["Nama", "Jumlah", "Kantor", "Mandiri", "Getback"]);
  for (const b of buckets ?? []) {
    ws.addRow([b.label, b.count, b.kantor, b.mandiri, b.getback]);
  }
  fitColumns(ws);
}

function buildSalesStatusSheet(
  ws: Worksheet,
  groups: SalesStatusGroup[],
  title = "Detail Status Database per Sales",
): void {
  const heading = ws.addRow([title]);
  heading.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(["Nama Sales", "Total"]);
  for (const group of groups) {
    const salesRow = ws.addRow([group.label, group.total]);
    salesRow.font = { bold: true };
    for (const s of group.statuses) {
      ws.addRow(["  " + s.label, s.count]);
    }
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
    doc.text(
      `${b.count} (K:${b.kantor} M:${b.mandiri})${b.getback > 0 ? ` · ${b.getback} getback` : ""}`,
      pageWidth - margin,
      y,
      { align: "right" },
    );
    y += 13;
  }
  y += 10;
  return y;
}

function drawPdfSalesStatusSection(
  doc: jsPDF,
  groups: SalesStatusGroup[],
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  title = "Detail Status Database per Sales",
): number {
  if (y + 40 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, margin, y);
  y += 16;

  for (const group of groups) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(group.label, margin, y);
    doc.text(String(group.total), pageWidth - margin, y, { align: "right" });
    y += 13;

    doc.setFont("helvetica", "normal");
    for (const s of group.statuses) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(s.label, margin + 12, y);
      doc.text(String(s.count), pageWidth - margin, y, { align: "right" });
      y += 12;
    }
    y += 6;
  }
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
