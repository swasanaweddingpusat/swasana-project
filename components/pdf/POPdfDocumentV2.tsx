import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { POPdfBooking } from "./POPdfDocument";
import { fmtRp, stripHtml } from "./pdfHelpers";

// ─── Theme constants (react-pdf StyleSheet needs literal hex; swap here to re-brand) ──
const ACCENT = "#3E6B5A";       // table header, subtitle
const ACCENT_DARK = "#2F5545";  // meta label cells, section headings
const INK = "#1A1A1A";          // body text
const BORDER = "#C9CFCC";       // hairline borders
const ZEBRA = "#F4F6F5";        // alt row background

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
  // Detail 2-col label|value
  detailRow: { flexDirection: "row", borderTopWidth: 1, borderColor: BORDER },
  detailLabel: { width: "30%", fontSize: 8, fontWeight: "bold", color: ACCENT_DARK, padding: 5, borderRightWidth: 1, borderColor: BORDER },
  detailValue: { width: "70%", fontSize: 8, padding: 5 },
  // Bullets
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 8 },
  bulletText: { flex: 1, fontSize: 8, textAlign: "justify" },
  note: { fontSize: 7, fontStyle: "italic", color: "#666", marginTop: 4 },
  // Signatures
  signRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  signBox: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, minHeight: 96, alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  signHead: { fontSize: 9, fontWeight: "bold", color: ACCENT_DARK, marginBottom: 4 },
  signImg: { width: 90, height: 40, objectFit: "contain", marginVertical: 4 },
  signName: { fontSize: 8, fontWeight: "bold", marginTop: 28 },
  signMeta: { fontSize: 7, color: "#555", marginTop: 2 },
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

// ─── Component ──────────────────────────────────────────────────────────────────
export function POPdfDocumentV2({ booking, logoBase64 }: { booking: POPdfBooking; logoBase64?: string | null }): React.ReactElement {
  const c = booking.snapCustomer;
  const created = booking.createdAt ?? new Date();
  const terms = booking.termOfPayments ?? [];
  const totalSchedule = terms.reduce((sum, t) => sum + Number(t.amount), 0);
  const comps = (booking.snapComplimentaries ?? []).length > 0
    ? (booking.snapComplimentaries ?? []).map((x) => ({ name: x.name, desc: x.description ?? "" }))
    : (booking.snapBonuses ?? []).map((x) => ({ name: x.vendorName, desc: x.description ?? "" }));

  // Event time: explicit eventTime, else session default, else "-"
  const sessionJam = booking.weddingSession === "morning" ? "08:00-14:00" : booking.weddingSession === "evening" ? "15:30-21:00" : booking.weddingSession === "fullday" ? "08:00-21:00" : "-";
  const jam = booking.eventTime?.trim() ? booking.eventTime.trim() : sessionJam;
  const waktu = `${fmtDate(booking.bookingDate)}${jam !== "-" ? ` · ${jam}` : ""}`;

  // Provider signer = last role signer (manager) if present
  const providerSigner = booking.signatures?.roles && booking.signatures.roles.length > 0
    ? booking.signatures.roles[booking.signatures.roles.length - 1]
    : null;

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

        {/* Meta 2x2 */}
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Nomor PO</Text>
            <Text style={s.metaValue}>{booking.poNumber ?? "-"}</Text>
            <Text style={s.metaLabel}>Tanggal PO</Text>
            <Text style={s.metaValueLast}>{fmtDateShort(created)}</Text>
          </View>
          <View style={[s.metaRow, { borderTopWidth: 1, borderColor: BORDER }]}>
            <Text style={s.metaLabel}>Berlaku s.d.</Text>
            <Text style={s.metaValue}>-</Text>
            <Text style={s.metaLabel}>Referensi</Text>
            <Text style={s.metaValueLast}>-</Text>
          </View>
        </View>

        {/* 1. PEMESAN DAN PENYEDIA */}
        <Text style={s.sectionTitle}>1.  PEMESAN DAN PENYEDIA</Text>
        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardHead}>PEMESAN</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Nama: </Text>{firstNonEmpty(c?.name)}</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Alamat: </Text>{firstNonEmpty(c?.cppAddress, c?.ktpAddress)}</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Telepon/WhatsApp: </Text>{phoneText(c?.mobileNumber)}</Text>
            <Text style={s.cardLine}><Text style={s.cardLabel}>Email: </Text>{firstNonEmpty(c?.emailCpp, c?.emailCpw)}</Text>
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

        {/* 3. NILAI DAN JADWAL PEMBAYARAN */}
        <Text style={s.sectionTitle}>3.  NILAI DAN JADWAL PEMBAYARAN</Text>
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

        {/* 4. INSTRUKSI PEMBAYARAN */}
        <Text style={s.sectionTitle}>4.  INSTRUKSI PEMBAYARAN</Text>
        {INSTRUKSI.map((t, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}

        {/* 5. SPECIAL OFFERING (hide if empty) — forced onto a fresh page via `break`
            so the table never splits across the page boundary. */}
        {comps.length > 0 && (
          <View break>
            <Text style={s.sectionTitle}>5.  SPECIAL OFFERING</Text>
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

        {/* 6. KETENTUAN UMUM */}
        <Text style={s.sectionTitle}>6.  KETENTUAN UMUM</Text>
        {KETENTUAN.map((t, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{t}</Text>
          </View>
        ))}

        {/* 7. PERSETUJUAN */}
        <Text style={s.sectionTitle}>7.  PERSETUJUAN</Text>
        <Text style={{ fontSize: 8, marginBottom: 6, textAlign: "justify" }}>
          Dengan menandatangani dokumen ini, para pihak menyetujui detail pesanan, nilai, jadwal pembayaran, dan ketentuan yang tercantum di atas.
        </Text>
        <View style={s.signRow}>
          <View style={s.signBox}>
            <Text style={s.signHead}>PEMESAN</Text>
            {booking.signatures?.client?.signature ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={booking.signatures.client.signature} style={s.signImg} />
            ) : null}
            <Text style={s.signName}>({firstNonEmpty(c?.name)})</Text>
            <Text style={s.signMeta}>Tanggal: __________________</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.signHead}>KEDIAMAN CORP.</Text>
            {providerSigner?.signature ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={providerSigner.signature} style={s.signImg} />
            ) : null}
            <Text style={s.signName}>({providerSigner?.name ?? "____________________"})</Text>
            <Text style={s.signMeta}>{providerSigner?.title ?? "Jabatan"} · Tanggal: __________</Text>
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
