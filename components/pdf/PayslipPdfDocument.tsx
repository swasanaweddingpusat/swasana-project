import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { fmtRp } from "./pdfHelpers";

export interface PayslipPdfData {
  employeeName: string;
  employeeNumber: number;
  departmentName: string | null;
  positionName: string | null;
  npwp: string | null;
  ptkpStatus: string | null;
  periodMonth: number;
  periodYear: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  totalWorkDays: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
  items: Array<{ name: string; type: string; amount: number; sortOrder: number }>;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ─── Theme (mirrors POPdfDocumentV2 — same brand palette across all generated docs) ──
const ACCENT = "#3E6B5A";
const ACCENT_DARK = "#2F5545";
const INK = "#1A1A1A";
const BORDER = "#C9CFCC";
const ZEBRA = "#F4F6F5";
const DANGER = "#B3261E";
const GOLD = "#D4A547";

const s = StyleSheet.create({
  page: { fontSize: 9, fontFamily: "Helvetica", color: INK, padding: 32, paddingBottom: 64 },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  companyName: { fontSize: 20, fontWeight: 800, color: INK, letterSpacing: 1 },
  titleWrap: { alignItems: "flex-end" },
  title: { fontSize: 20, fontWeight: "bold", color: INK, letterSpacing: 1 },
  subtitle: { fontSize: 10, fontWeight: "bold", color: ACCENT, letterSpacing: 2, marginTop: 2 },
  // Meta
  metaTable: { flexDirection: "row", borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  metaLabel: { width: "18%", backgroundColor: ACCENT_DARK, color: "#fff", fontWeight: "bold", fontSize: 8, padding: 5 },
  metaValue: { width: "32%", padding: 5, fontSize: 8, borderRightWidth: 1, borderColor: BORDER },
  metaValueLast: { width: "32%", padding: 5, fontSize: 8 },
  // Section
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: ACCENT_DARK, marginTop: 10, marginBottom: 6 },
  // Detail 2-col label|value
  detailTable: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  detailRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  detailRowFirst: { flexDirection: "row" },
  detailLabel: { width: "30%", fontSize: 8, fontWeight: "bold", color: ACCENT_DARK, padding: 5, borderRightWidth: 1, borderColor: BORDER },
  detailValue: { width: "70%", fontSize: 8, padding: 5 },
  // Attendance grid
  attGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  attCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 8, alignItems: "center" },
  attNum: { fontSize: 16, fontWeight: 800, color: ACCENT },
  attLabel: { fontSize: 7, color: "#888", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  // Generic table
  table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
  th: { flexDirection: "row", backgroundColor: ACCENT },
  thCellNo: { width: "8%", color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5, textAlign: "center", borderRightWidth: 1, borderColor: "#ffffff55" },
  thCell: { flex: 1, color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5, borderRightWidth: 1, borderColor: "#ffffff55" },
  thCellLast: { width: "30%", color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5, textAlign: "right" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  tdNo: { width: "8%", fontSize: 8, padding: 5, textAlign: "center", borderRightWidth: 1, borderColor: BORDER },
  td: { flex: 1, fontSize: 8, padding: 5, borderRightWidth: 1, borderColor: BORDER },
  tdLast: { width: "30%", fontSize: 8, padding: 5, textAlign: "right" },
  emptyRow: { fontSize: 8, fontStyle: "italic", color: "#999", padding: 6 },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderColor: ACCENT_DARK, backgroundColor: ACCENT_DARK },
  totalLabel: { flex: 1, color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5 },
  totalValue: { width: "30%", color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5, textAlign: "right" },
  // Summary
  sumTable: { borderWidth: 1, borderColor: BORDER, marginTop: 6, marginBottom: 12 },
  sumRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  sumLabel: { width: "70%", fontSize: 8, fontWeight: "bold", padding: 5, borderRightWidth: 1, borderColor: BORDER },
  sumValue: { width: "30%", fontSize: 8, padding: 5, textAlign: "right" },
  netRow: { flexDirection: "row", borderTopWidth: 1, borderColor: ACCENT_DARK, backgroundColor: ACCENT_DARK },
  netLabel: { width: "70%", color: GOLD, fontSize: 10, fontWeight: "bold", padding: 5 },
  netValue: { width: "30%", color: "#fff", fontSize: 9, fontWeight: "bold", padding: 5, textAlign: "right" },
  note: { fontSize: 7, fontStyle: "italic", color: "#666", marginTop: 4 },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, borderTopWidth: 1, borderColor: BORDER, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#777" },
});

function ItemTable({ items }: { items: PayslipPdfData["items"] }): React.ReactElement {
  return (
    <View style={s.table}>
      <View style={s.th}>
        <Text style={s.thCellNo}>No.</Text>
        <Text style={s.thCell}>Komponen</Text>
        <Text style={s.thCellLast}>Nominal</Text>
      </View>
      {items.length === 0 ? (
        <View style={s.tr}>
          <Text style={s.emptyRow}>Tidak ada data</Text>
        </View>
      ) : (
        items.map((item, i) => (
          <View key={item.name + i} style={[s.tr, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
            <Text style={s.tdNo}>{i + 1}</Text>
            <Text style={s.td}>{item.name}</Text>
            <Text style={s.tdLast}>{fmtRp(item.amount)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export function PayslipPdfDocument({ data, logoBase64 }: { data: PayslipPdfData; logoBase64?: string | null }): React.ReactElement {
  const periodLabel = `${MONTH_NAMES[(data.periodMonth ?? 1) - 1]} ${data.periodYear}`;
  const printedAt = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const earningRows = data.items.filter((i) => i.type === "earning").sort((a, b) => a.sortOrder - b.sortOrder);
  const deductionRows = data.items.filter((i) => i.type === "deduction").sort((a, b) => a.sortOrder - b.sortOrder);

  const detailRows = [
    { label: "Nama Karyawan", value: data.employeeName },
    { label: "No. Karyawan", value: String(data.employeeNumber) },
    { label: "Departemen", value: data.departmentName ?? "-" },
    { label: "Posisi / Jabatan", value: data.positionName ?? "-" },
    { label: "NPWP", value: data.npwp ?? "-" },
    { label: "Status PTKP", value: data.ptkpStatus ?? "-" },
  ];

  const attCards = [
    { label: "Hari Kerja", value: data.totalWorkDays },
    { label: "Hadir", value: data.totalPresent },
    { label: "Absen", value: data.totalAbsent },
    { label: "Terlambat", value: data.totalLate },
    { label: "Cuti", value: data.totalLeave },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          {logoBase64 ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoBase64} style={{ width: 120, height: 44, objectFit: "contain" }} />
          ) : (
            <Text style={s.companyName}>SWASANA</Text>
          )}
          <View style={s.titleWrap}>
            <Text style={s.title}>SLIP GAJI</Text>
            <Text style={s.subtitle}>SALARY SLIP</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={s.metaTable}>
          <Text style={s.metaLabel}>Periode</Text>
          <Text style={s.metaValue}>{periodLabel}</Text>
          <Text style={s.metaLabel}>Dicetak</Text>
          <Text style={s.metaValueLast}>{printedAt}</Text>
        </View>

        {/* 1. INFORMASI KARYAWAN */}
        <Text style={s.sectionTitle}>1.  INFORMASI KARYAWAN</Text>
        <View style={s.detailTable}>
          {detailRows.map((row, i) => (
            <View key={row.label} style={i === 0 ? s.detailRowFirst : s.detailRow}>
              <Text style={s.detailLabel}>{row.label}</Text>
              <Text style={s.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* 2. RINGKASAN KEHADIRAN */}
        <Text style={s.sectionTitle}>2.  RINGKASAN KEHADIRAN</Text>
        <View style={s.attGrid}>
          {attCards.map((card) => (
            <View key={card.label} style={s.attCard}>
              <Text style={s.attNum}>{card.value}</Text>
              <Text style={s.attLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* 3. PENDAPATAN */}
        <Text style={s.sectionTitle}>3.  PENDAPATAN</Text>
        <ItemTable items={earningRows} />
        <View style={[s.totalRow, { marginTop: -8, marginBottom: 8 }]}>
          <Text style={s.totalLabel}>TOTAL PENDAPATAN</Text>
          <Text style={s.totalValue}>{fmtRp(data.totalEarnings)}</Text>
        </View>

        {/* 4. POTONGAN */}
        <Text style={s.sectionTitle}>4.  POTONGAN</Text>
        <ItemTable items={deductionRows} />
        <View style={[s.totalRow, { marginTop: -8, marginBottom: 8 }]}>
          <Text style={s.totalLabel}>TOTAL POTONGAN</Text>
          <Text style={s.totalValue}>{fmtRp(data.totalDeductions)}</Text>
        </View>

        {/* 5. PERHITUNGAN GAJI BERSIH */}
        <Text style={s.sectionTitle}>5.  PERHITUNGAN GAJI BERSIH</Text>
        <View style={s.sumTable}>
          <View style={s.detailRowFirst}>
            <Text style={s.sumLabel}>Total Pendapatan</Text>
            <Text style={s.sumValue}>{fmtRp(data.totalEarnings)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={[s.sumLabel, { color: DANGER }]}>Total Potongan</Text>
            <Text style={[s.sumValue, { color: DANGER }]}>- {fmtRp(data.totalDeductions)}</Text>
          </View>
          <View style={s.netRow}>
            <Text style={s.netLabel}>Gaji Bersih (Take Home Pay)</Text>
            <Text style={s.netValue}>{fmtRp(data.netSalary)}</Text>
          </View>
        </View>
        <Text style={s.note}>*Slip gaji ini diterbitkan secara elektronik dan sah tanpa tanda tangan basah.</Text>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>SWASANA · Human Resources Department</Text>
          <Text style={s.footerText} render={({ pageNumber }) => `Halaman ${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}
