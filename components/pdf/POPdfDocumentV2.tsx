import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { POPdfBooking } from "./POPdfDocument";
import { fmtRp, stripHtml } from "./pdfHelpers";

// ─── Package table row (Detail Package) ─────────────────────────────────────────
interface PackageRow { no: string; desc: string; descBold?: boolean; total: string; isSpacer?: boolean; isTakeout?: boolean }

/** Strip tags, turn <br>/</li>/</p> into line breaks, drop blank lines. Handles both HTML and plain "\n" text. */
function htmlToLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const withBreaks = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<\/p>/gi, "\n");
  return stripHtml(withBreaks).split("\n").map((l) => l.trim()).filter(Boolean);
}

// ─── Theme constants (react-pdf StyleSheet needs literal hex; swap here to re-brand) ──
const ACCENT = "#3E6B5A";       // table header, subtitle
const ACCENT_DARK = "#2F5545";  // meta label cells, section headings
const INK = "#1A1A1A";          // body text
const BORDER = "#C9CFCC";       // hairline borders
const ZEBRA = "#F4F6F5";        // alt row background
const DANGER = "#B3261E";       // discount / deduction rows

// ─── Provider (hardcoded per spec) ──────────────────────────────────────────────
const PROVIDER = {
  name: "Kediaman Corp.",
  address: "Jl. HR. Rasuna Said Kav. B12, Jakarta Selatan 12920",
  contact: "Rosita · 0811 8884 481",
};

const s = StyleSheet.create({
  page: { fontSize: 9, fontFamily: "Helvetica", color: INK, padding: 32, paddingBottom: 64 },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  logo: { width: 120, height: 44, objectFit: "contain" },
  titleWrap: { alignItems: "flex-end" },
  title: { fontSize: 20, fontWeight: "bold", color: INK, letterSpacing: 1 },
  subtitle: { fontSize: 10, fontWeight: "bold", color: ACCENT, letterSpacing: 2, marginTop: 2 },
  // Meta 2x2
  metaTable: { borderWidth: 1, borderColor: BORDER, marginBottom: 16 },
  metaRow: { flexDirection: "row" },
  metaLabel: { width: "18%", backgroundColor: ACCENT_DARK, color: "#fff", fontWeight: "bold", fontSize: 8, padding: 5 },
  metaValue: { width: "32%", padding: 5, fontSize: 8, borderRightWidth: 1, borderColor: BORDER },
  metaValueLast: { width: "32%", padding: 5, fontSize: 8 },
  // Section
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: ACCENT_DARK, marginTop: 10, marginBottom: 6 },
  // Party cards
  cardRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  card: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 8 },
  cardHead: { fontSize: 9, fontWeight: "bold", color: ACCENT_DARK, marginBottom: 4 },
  cardLine: { fontSize: 8, marginBottom: 2 },
  cardLabel: { fontWeight: "bold" },
  // Generic table
  table: { borderWidth: 1, borderColor: BORDER },
  th: { flexDirection: "row", backgroundColor: ACCENT, },
  thCell: { color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5, borderRightWidth: 1, borderColor: "#ffffff55" },
  thCellLast: { color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  td: { fontSize: 8, padding: 5, borderRightWidth: 1, borderColor: BORDER },
  tdLast: { fontSize: 8, padding: 5 },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER, backgroundColor: ACCENT_DARK },
  totalCell: { color: "#fff", fontSize: 8, fontWeight: "bold", padding: 5 },
  // Summary payment
  sumTable: { borderWidth: 1, borderColor: BORDER, marginTop: 4 },
  sumRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  sumLabel: { width: "70%", fontSize: 8, fontWeight: "bold", padding: 5, borderRightWidth: 1, borderColor: BORDER },
  sumValue: { width: "30%", fontSize: 8, padding: 5 },
  // Detail 2-col label|value
  detailRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  detailLabel: { width: "30%", fontSize: 8, fontWeight: "bold", color: ACCENT_DARK, padding: 5, borderRightWidth: 1, borderColor: BORDER },
  detailValue: { width: "70%", fontSize: 8, padding: 5 },
  // Package table (grouped rows: NO/Total pinned top, DESCRIPTION stacked)
  pkgRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  pkgNoCell: { width: "8%", padding: 5, borderRightWidth: 1, borderColor: BORDER },
  pkgDescCell: { width: "67%", flexDirection: "column", borderRightWidth: 1, borderColor: BORDER },
  pkgDescSubRow: { paddingHorizontal: 5, paddingVertical: 1.5 },
  pkgTotalCell: { width: "25%", padding: 5 },
  // Bullets
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 8 },
  bulletText: { flex: 1, fontSize: 8, textAlign: "justify" },
  note: { fontSize: 7, fontStyle: "italic", color: "#666", marginTop: 4 },
  // Signatures
  signRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  signBox: { flex: 1, flexDirection: "column", borderWidth: 1, borderColor: BORDER, borderRadius: 4, minHeight: 110, alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  signHead: { fontSize: 9, fontWeight: "bold", color: ACCENT_DARK },
  signImgWrap: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  signImg: { width: 130, height: 56, objectFit: "contain" },
  signName: { fontSize: 8, fontWeight: "bold" },
  // Footer
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, borderTopWidth: 1, borderColor: BORDER, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#777" },
});

// ─── Fixed copy (mirrors reference doc) ─────────────────────────────────────────
const INSTRUKSI: string[] = [
  "Pembayaran dilakukan melalui transfer bank ke rekening resmi yang tercantum pada invoice Kediaman Corp.",
  "Invoice dikirim kepada Pemesan sebelum jatuh tempo. Bukti pembayaran disampaikan kepada PIC Finance Kediaman Corp.",
  "Pembayaran dinyatakan diterima setelah dikonfirmasi oleh Finance Kediaman Corp.",
];
const KETENTUAN: string[] = [
  "Perubahan paket, tanggal, venue, jumlah tamu, atau fasilitas harus disetujui secara tertulis dan dapat menyebabkan penyesuaian nilai pesanan serta jadwal pembayaran.",
  "Layanan tambahan atau upgrade akan ditagihkan terpisah setelah memperoleh persetujuan tertulis dari Pemesan.",
  "Reservasi dan pelaksanaan acara mengikuti pembayaran yang telah diterima sesuai jadwal di atas.",
  "Purchase Order ini merupakan satu kesatuan dengan quotation, invoice, dan Terms & Conditions Kediaman Corp. yang disetujui Pemesan.",
];

// ─── Helpers (local, non-shared) ────────────────────────────────────────────────
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" });
}

function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" });
}

function eventTypeLabel(code: string | null | undefined): string {
  const map: Record<string, string> = { R: "Resepsi", AR: "Akad & Resepsi", TR: "Teapai & Resepsi", PR: "Pemberkatan & Resepsi", VO: "Venue Only" };
  if (!code) return "Wedding Reception";
  return map[code] ?? code;
}

function phoneText(raw: string | null | undefined): string {
  if (!raw) return "-";
  try {
    const arr = JSON.parse(raw) as { name?: string; number: string }[];
    if (Array.isArray(arr)) return arr.map((e) => (e.name ? `${e.number} (${e.name})` : e.number)).join(", ");
  } catch { /* not JSON */ }
  return raw;
}

function firstNonEmpty(...vals: (string | null | undefined)[]): string {
  for (const v of vals) { if (v && v.trim()) return v.trim(); }
  return "-";
}

/** Gabung nilai CPP & CPW jadi satu baris: "<cpp> (cpp), <cpw> (cpw)". Sisi kosong di-skip. */
function joinCppCpw(cpp?: string | null, cpw?: string | null): string {
  const parts: string[] = [];
  if (cpp?.trim()) parts.push(`${cpp.trim()} (cpp)`);
  if (cpw?.trim()) parts.push(`${cpw.trim()} (cpw)`);
  return parts.join(", ");
}

/** Mirrors POPdfDocument's buildTableRows: header (venue+pax+price) → notes →
 *  internal items (benefit first) → vendor items, each item group separated by a spacer row. */
function buildPackageRows(booking: POPdfBooking): PackageRow[] {
  const venueName = booking.snapVenue?.venueName ?? "";
  const packageName = booking.snapPackage?.packageName ?? "";
  const pricingPackageName = booking.snapPackagePricing?.packageName ?? "";
  const pax = booking.snapPackagePricing?.pax ?? "";
  const price = booking.snapPackagePricing ? fmtRp(booking.snapPackagePricing.price) : "";
  const notes = htmlToLines(booking.snapPackage?.notes);
  const internalItems = [...(booking.snapPackageInternalItems ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const vendorItems = [...(booking.snapPackageVendorItems ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: PackageRow[] = [];
  const tierSuffix = pricingPackageName && pricingPackageName !== packageName ? ` - ${pricingPackageName}` : "";
  rows.push({ no: "1", desc: `${venueName} ${packageName}${tierSuffix}${pax ? ` untuk ${pax} orang, termasuk:` : ""}`, descBold: true, total: price });
  notes.forEach((note) => rows.push({ no: "", desc: note, total: "" }));

  const benefitItems = internalItems.filter((i) => i.itemName.toLowerCase().includes("benefit"));
  const nonBenefitItems = internalItems.filter((i) => !i.itemName.toLowerCase().includes("benefit"));

  benefitItems.forEach((item) => {
    rows.push({ no: "2", desc: item.itemName, descBold: true, total: "" });
    htmlToLines(item.itemDescription).forEach((line) => rows.push({ no: "", desc: line, total: "" }));
    rows.push({ no: "", desc: "", total: "", isSpacer: true });
  });

  // Internal items first (A, B, C…), then vendor items — each group numbered from
  // its own sortOrder, so keep the two lists contiguous rather than merge-sorting them.
  let alpha = 0;
  nonBenefitItems.forEach((item) => {
    const letter = String.fromCharCode(65 + alpha++);
    rows.push({ no: "", desc: `${letter}. ${item.itemName}`, descBold: true, total: "" });
    htmlToLines(item.itemDescription).forEach((line) => rows.push({ no: "", desc: line, total: "" }));
    rows.push({ no: "", desc: "", total: "", isSpacer: true });
  });
  vendorItems.forEach((item) => {
    const letter = String.fromCharCode(65 + alpha++);
    const isTakeout = item.isTakeout ?? false;
    rows.push({ no: "", desc: `${letter}. ${item.categoryName}${isTakeout ? " (TAKEOUT)" : ""}`, descBold: true, total: "", isTakeout });
    htmlToLines(item.itemText).forEach((line) => rows.push({ no: "", desc: `   ${line}`, total: "", isTakeout }));
    rows.push({ no: "", desc: "", total: "", isSpacer: true });
  });

  return rows;
}

/** Groups PackageRow[] on isSpacer boundaries — each group renders as one table row
 *  with its NO/Total pinned to the top and DESCRIPTION stacked as sub-rows. */
function groupPackageRows(rows: PackageRow[]): PackageRow[][] {
  const groups: PackageRow[][] = [];
  let current: PackageRow[] = [];
  rows.forEach((row) => {
    if (row.isSpacer) {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(row);
    }
  });
  if (current.length > 0) groups.push(current);
  return groups;
}

// ─── Component ──────────────────────────────────────────────────────────────────
export function POPdfDocumentV2({ booking, logoBase64 }: { booking: POPdfBooking; logoBase64?: string | null }): React.ReactElement {
  const c = booking.snapCustomer;
  const created = booking.createdAt ?? new Date();
  const terms = booking.termOfPayments ?? [];
  const totalSchedule = terms.reduce((sum, t) => sum + Number(t.amount), 0);

  // Summary payment: total → discount (kalau ada) → dikurangi cash-in ber-flag showInPo → sisa bayar
  const grossPrice = booking.snapPackagePricing?.price ?? 0;
  const hasDiscount = (booking.discountAmount ?? 0) > 0;
  const netPrice = hasDiscount ? Math.max(0, grossPrice - (booking.discountAmount ?? 0)) : grossPrice;
  const poPayments = booking.poPayments ?? [];
  const totalPaid = poPayments.reduce((sum, p) => sum + p.amount, 0);
  const sisaBayar = Math.max(0, netPrice - totalPaid);

  const comps = (booking.snapComplimentaries ?? []).length > 0
    ? (booking.snapComplimentaries ?? []).map((x) => ({ name: x.name, desc: x.description ?? "" }))
    : (booking.snapBonuses ?? []).map((x) => ({ name: x.vendorName, desc: x.description ?? "" }));

  // Event time: explicit eventTime, else session default, else "-"
  const sessionJam = booking.weddingSession === "morning" ? "08:00-14:00" : booking.weddingSession === "evening" ? "15:30-21:00" : booking.weddingSession === "fullday" ? "08:00-21:00" : "-";
  const jam = booking.eventTime?.trim() ? booking.eventTime.trim() : sessionJam;
  const waktu = `${fmtDate(booking.bookingDate)}${jam !== "-" ? ` · ${jam}` : ""}`;

  // PO v2 hanya nampilin ttd Pemesan & Sales — manager/role approver lain (kalau ada) sengaja gak ditampilin
  const salesSigner = booking.signatures?.roles?.find((r) => r.title === "Sales") ?? null;

  // KTP vs Paspor — dua tipe identitas terpisah, masing-masing baris cuma tampil kalau ada isinya
  const cppIdType = c?.cppIdType ?? "KTP";
  const cpwIdType = c?.cpwIdType ?? "KTP";
  const cppNikVal = c?.cppNik?.trim() ?? "";
  const cpwNikVal = c?.cpwNik?.trim() ?? "";
  const idKtp = joinCppCpw(cppIdType === "KTP" ? cppNikVal || null : null, cpwIdType === "KTP" ? cpwNikVal || null : null);
  const idPaspor = joinCppCpw(cppIdType === "Paspor" ? cppNikVal || null : null, cpwIdType === "Paspor" ? cpwNikVal || null : null);

  // Baris kartu PEMESAN — hanya tampil kalau ada isinya
  const pemesanRows = [
    { label: "Nama", value: firstNonEmpty(c?.name) },
    { label: "Alamat CPP", value: c?.cppAddress?.trim() || "" },
    { label: "Alamat CPW", value: c?.cpwAddress?.trim() || "" },
    { label: "Telepon/WhatsApp", value: phoneText(c?.mobileNumber) },
    { label: "Email", value: firstNonEmpty(c?.emailCpp, c?.emailCpw) },
    { label: "KTP", value: idKtp },
    { label: "Paspor", value: idPaspor },
  ].filter((row) => row.value && row.value !== "-");

  const packageRows = buildPackageRows(booking);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          {logoBase64 ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoBase64} style={s.logo} />
          ) : <View style={s.logo} />}
          <View style={s.titleWrap}>
            <Text style={s.title}>PURCHASE ORDER</Text>
            <Text style={s.subtitle}>WEDDING PACKAGE</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Nomor PO</Text>
            <Text style={s.metaValue}>{booking.poNumber ?? "-"}</Text>
            <Text style={s.metaLabel}>Tanggal PO</Text>
            <Text style={s.metaValueLast}>{fmtDateShort(created)}</Text>
          </View>
        </View>

        {/* 1. PEMESAN DAN PENYEDIA */}
        <Text style={s.sectionTitle}>1.  PEMESAN DAN PENYEDIA</Text>
        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardHead}>PEMESAN</Text>
            {pemesanRows.map((row) => (
              <Text key={row.label} style={s.cardLine}><Text style={s.cardLabel}>{row.label}: </Text>{row.value}</Text>
            ))}
          </View>
          <View style={s.card}>
            <Text style={s.cardHead}>PENYEDIA</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Nama: </Text>{PROVIDER.name}</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Alamat: </Text>{PROVIDER.address}</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Kontak: </Text>{PROVIDER.contact}</Text>
          </View>
        </View>

        {/* 2. DETAIL PESANAN */}
        <Text style={s.sectionTitle}>2.  DETAIL PESANAN</Text>
        <View style={s.table}>
          {[
            { label: "Nama Pengantin", value: firstNonEmpty(c?.name) },
            { label: "Venue", value: firstNonEmpty(booking.snapVenue?.venueName) },
            { label: "Jenis Acara", value: eventTypeLabel(booking.weddingType) },
            { label: "Tanggal & Waktu", value: waktu },
            { label: "Nama Paket", value: firstNonEmpty(booking.snapPackage?.packageName) },
          ].map((row, i) => (
            <View key={i} style={i === 0 ? { flexDirection: "row" } : s.detailRow}>
              <Text style={s.detailLabel}>{row.label}</Text>
              <Text style={s.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* 3. SPECIAL OFFERING (hide if empty) */}
        {comps.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>3.  SPECIAL OFFERING</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { width: "8%" }]}>No.</Text>
                <Text style={[s.thCell, { width: "42%" }]}>Complimentary</Text>
                <Text style={[s.thCellLast, { width: "50%" }]}>Keterangan</Text>
              </View>
              {comps.map((cp, i) => (
                <View key={i} style={[s.tr, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <Text style={[s.td, { width: "8%" }]}>{i + 1}</Text>
                  <Text style={[s.td, { width: "42%", fontWeight: "bold" }]}>{cp.name}</Text>
                  <Text style={[s.tdLast, { width: "50%" }]}>{cp.desc ? stripHtml(cp.desc) : "-"}</Text>
                </View>
              ))}
            </View>
            <Text style={s.note}>Complimentary tidak dapat dialihkan atau ditukarkan dengan uang.</Text>
          </View>
        )}

        {/* 4. DETAIL PACKAGE */}
        <Text style={s.sectionTitle}>4.  DETAIL PACKAGE</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thCell, { width: "8%" }]}>No.</Text>
            <Text style={[s.thCell, { width: "67%" }]}>Deskripsi</Text>
            <Text style={[s.thCellLast, { width: "25%" }]}>Total (Rp)</Text>
          </View>
          {groupPackageRows(packageRows).map((group, gi) => {
            const noValue = group.find((r) => r.no)?.no ?? "";
            const totalValue = group.find((r) => r.total)?.total ?? "";
            return (
              <View key={gi} style={s.pkgRow}>
                <View style={s.pkgNoCell}>{noValue ? <Text style={{ fontSize: 8 }}>{noValue}</Text> : null}</View>
                <View style={s.pkgDescCell}>
                  {group.map((row, ri) => (
                    <Text
                      key={ri}
                      style={[
                        s.pkgDescSubRow,
                        { fontSize: 8, fontWeight: row.descBold ? "bold" : "normal" },
                        row.isTakeout ? { textDecoration: "line-through", color: "#999" } : {},
                      ]}
                    >
                      {row.desc}
                    </Text>
                  ))}
                </View>
                <View style={s.pkgTotalCell}>{totalValue ? <Text style={{ fontSize: 8 }}>{totalValue}</Text> : null}</View>
              </View>
            );
          })}
        </View>

        {/* Riwayat Pembayaran — total, discount (kalau ada), cash-in ber-flag showInPo, sisa bayar */}
        <View style={s.sumTable}>
          <View style={s.th}>
            <Text style={[s.thCell, { width: "70%" }]}>RIWAYAT PEMBAYARAN</Text>
            <Text style={[s.thCellLast, { width: "30%" }]}>NOMINAL</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLabel}>Total Payment</Text>
            <Text style={s.sumValue}>{fmtRp(grossPrice)}</Text>
          </View>
          {hasDiscount && (
            <>
              <View style={s.sumRow}>
                <Text style={[s.sumLabel, { color: DANGER }]}>{booking.discountName || "Discount"}</Text>
                <Text style={[s.sumValue, { color: DANGER }]}>- {fmtRp(booking.discountAmount!)}</Text>
              </View>
              <View style={s.sumRow}>
                <Text style={s.sumLabel}>Harga Setelah Discount</Text>
                <Text style={s.sumValue}>{fmtRp(netPrice)}</Text>
              </View>
            </>
          )}
          {poPayments.map((p, i) => (
            <View key={i} style={s.sumRow}>
              <Text style={s.sumLabel}>{p.label}</Text>
              <Text style={s.sumValue}>- {fmtRp(p.amount)}</Text>
            </View>
          ))}
          <View style={[s.sumRow, { backgroundColor: ACCENT_DARK }]}>
            <Text style={[s.sumLabel, { color: "#fff", borderColor: BORDER }]}>Sisa Bayar</Text>
            <Text style={[s.sumValue, { color: "#fff" }]}>{fmtRp(sisaBayar)}</Text>
          </View>
        </View>

        {/* 5. NILAI DAN JADWAL PEMBAYARAN */}
        <Text style={s.sectionTitle}>5.  NILAI DAN JADWAL PEMBAYARAN</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thCell, { width: "8%" }]}>No.</Text>
            <Text style={[s.thCell, { width: "32%" }]}>Tahap</Text>
            <Text style={[s.thCell, { width: "27%" }]}>Nominal</Text>
            <Text style={[s.thCellLast, { width: "33%" }]}>Jatuh Tempo</Text>
          </View>
          {terms.map((t, i) => (
            <View key={t.id} style={[s.tr, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
              <Text style={[s.td, { width: "8%" }]}>{i + 1}</Text>
              <Text style={[s.td, { width: "32%", fontWeight: "bold" }]}>{t.name}</Text>
              <Text style={[s.td, { width: "27%" }]}>{fmtRp(t.amount)}</Text>
              <Text style={[s.tdLast, { width: "33%" }]}>{t.dueDate ? fmtDateShort(t.dueDate) : "-"}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.totalCell, { width: "40%" }]}>TOTAL NILAI JADWAL AWAL</Text>
            <Text style={[s.totalCell, { width: "27%" }]}>{fmtRp(totalSchedule)}</Text>
            <Text style={[s.totalCell, { width: "33%" }]}> </Text>
          </View>
        </View>
        <Text style={s.note}>*Nilai akhir dapat berubah sesuai paket, venue, dan tambahan layanan yang disetujui Pemesan.</Text>

        {/* 6. INSTRUKSI PEMBAYARAN */}
        <Text style={s.sectionTitle}>6.  INSTRUKSI PEMBAYARAN</Text>
        {INSTRUKSI.map((t, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}

        {/* 7. KETENTUAN UMUM */}
        <Text style={s.sectionTitle}>7.  KETENTUAN UMUM</Text>
        {KETENTUAN.map((t, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}

        {/* 8. PERSETUJUAN */}
        <Text style={s.sectionTitle}>8.  PERSETUJUAN</Text>
        <Text style={{ fontSize: 8, marginBottom: 6, textAlign: "justify" }}>
          Dengan menandatangani dokumen ini, para pihak menyetujui detail pesanan, nilai, jadwal pembayaran, dan ketentuan yang tercantum di atas.
        </Text>
        <View style={s.signRow}>
          <View style={s.signBox}>
            <Text style={s.signHead}>PEMESAN</Text>
            <View style={s.signImgWrap}>
              {booking.signatures?.client?.signature ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={booking.signatures.client.signature} style={s.signImg} />
              ) : null}
            </View>
            <Text style={s.signName}>({firstNonEmpty(c?.name)})</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.signHead}>SALES</Text>
            <View style={s.signImgWrap}>
              {salesSigner?.signature ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={salesSigner.signature} style={s.signImg} />
              ) : null}
            </View>
            <Text style={s.signName}>({salesSigner?.name ?? booking.sales?.fullName ?? "____________________"})</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Kediaman Corp · Head Office · {PROVIDER.address}</Text>
          <Text style={s.footerText} render={({ pageNumber }) => `Halaman ${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}
