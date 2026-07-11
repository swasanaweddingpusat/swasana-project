import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Line } from "@react-pdf/renderer";
import type { LedgerEntry } from "@/types/finance";

/**
 * Kwitansi (payment receipt) PDF — FE-only, rendered client-side via `pdf().toBlob()`.
 * Replicates the formal Gunawarman receipt layout. All org/signer values below are
 * dummy placeholders for the design phase (no DB wiring yet).
 */

// ─── Dummy org constants (design phase) ───────────────────────────────────────
const ORG_NAME = "GUNAWARMAN HALLMARK & EVENT";
const ORG_TAGLINE = "Wedding Venue and Organizer";
const ORG_VENUE = "SOPODEL TOWER - SAMISARA GRAND BALLROOM";
const ORG_ADDRESS = "Jl. Mega Kuningan Barat III, Kuningan Timur, Setiabudi, Jakarta";
const ORG_PHONE = "TELPON";
const ORG_EMAIL = "EMAIL";
const SIGNER_CITY = "Jakarta";
const DEFAULT_SIGNER = "ROSITA";
const SIGNER_ROLE = "FINANCE";
// Disclaimer tetap — selalu muncul di kwitansi (bukan dari input catatan).
const KETERANGAN_DISCLAIMER = "Tidak menerima pembayaran cash/cek/giro/kartukredit";

// ─── Palette (hardcoded hex OK — react-pdf document renderer, same as POPdfDocument) ──
const ACCENT = "#5F5F94";
// Security-paper texture (biru) — meniru kwitansi asli: titik-titik & garis halus
const SECURITY_BLUE = "#3B5BA9";

// ─── Local number → words (title-cased, "Rupiah" suffix) ──────────────────────
const SATUAN = [
  "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan",
  "Sembilan", "Sepuluh", "Sebelas",
];

function spell(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ""}`;
  if (n < 200) return `Seratus${n % 100 ? ` ${spell(n % 100)}` : ""}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} Ratus${n % 100 ? ` ${spell(n % 100)}` : ""}`;
  if (n < 2000) return `Seribu${n % 1000 ? ` ${spell(n % 1000)}` : ""}`;
  if (n < 1_000_000) return `${spell(Math.floor(n / 1000))} Ribu${n % 1000 ? ` ${spell(n % 1000)}` : ""}`;
  if (n < 1_000_000_000) return `${spell(Math.floor(n / 1_000_000))} Juta${n % 1_000_000 ? ` ${spell(n % 1_000_000)}` : ""}`;
  return `${spell(Math.floor(n / 1_000_000_000))} Miliar${n % 1_000_000_000 ? ` ${spell(n % 1_000_000_000)}` : ""}`;
}

function terbilangTitle(n: number): string {
  if (n <= 0) return "Nol Rupiah";
  return `${spell(Math.floor(n)).replace(/\s+/g, " ").trim()} Rupiah`;
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtLongDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: "#000",
    padding: 30,
    position: "relative",
  },
  border: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  // Header
  header: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 66, height: 54, objectFit: "contain", marginRight: 14 },
  orgName: { fontFamily: "Times-Bold", fontSize: 15, letterSpacing: 0.3 },
  orgTagline: { fontFamily: "Times-Bold", fontSize: 9 },
  orgVenue: { fontFamily: "Times-Bold", fontSize: 9, marginTop: 2 },
  orgAddr: { fontSize: 8, color: "#333", marginTop: 1 },
  // Title band — "KWITANSI" duduk di atas security-hatch biru (full width)
  titleBand: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    marginTop: 10,
    marginBottom: 6,
  },
  titleTextWrap: { backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 1 },
  title: { fontFamily: "Times-Bold", fontSize: 18, letterSpacing: 6, textAlign: "center" },
  nomor: { fontFamily: "Times-Bold", fontSize: 11, textAlign: "center", marginTop: 2 },
  // Body rows
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 11 },
  label: { fontFamily: "Times-Bold", width: 120, fontSize: 11 },
  colon: { width: 12, fontSize: 11 },
  value: { flex: 1, fontSize: 11 },
  valueBold: { flex: 1, fontFamily: "Times-Bold", fontSize: 11 },
  uangBox: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#FCFCFF",
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  uangText: { fontFamily: "Times-Italic", fontSize: 11 },
  // Full-bleed security texture painted behind box content (clipped by parent overflow)
  fillSvg: { position: "absolute", top: 0, left: 0 },
  // Amount + date row
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#FCFCFF",
    paddingVertical: 5,
    paddingHorizontal: 10,
    width: 240,
  },
  amountLabel: { fontFamily: "Times-BoldItalic", fontSize: 12, width: 92 },
  amountValue: { fontFamily: "Times-Bold", fontSize: 12 },
  dateText: { fontSize: 10, textAlign: "center" },
  // Keterangan + signature
  footRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  ketLabel: { fontFamily: "Times-Italic", fontSize: 9, marginBottom: 3 },
  ketBox: {
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "#FCFCFF",
    padding: 8,
    minHeight: 74,
    justifyContent: "space-between",
  },
  ketText: { fontFamily: "Times-Italic", fontSize: 9 },
  signCol: { width: 150, alignItems: "center", justifyContent: "flex-end" },
  signStamp: { width: 54, height: 44, objectFit: "contain", opacity: 0.45, marginBottom: 2 },
  signName: { fontFamily: "Times-Bold", fontSize: 10, textDecoration: "underline" },
  signRole: { fontSize: 9, marginTop: 1 },
});

// ─── Security textures (SVG, painted behind box content) ──────────────────────
/**
 * Blue dotted stipple — meniru texture kwitansi asli. react-pdf v4 gak punya
 * <pattern>, jadi titik-titik dibikin dari garis dashed round-cap yang di-tile
 * per baris (dash 0.6 → titik, gap 3 → spasi antar titik).
 */
function DotFill({ width, height }: { width: number; height: number }): React.ReactElement {
  const rows = Math.ceil(height / 3) + 1;
  return (
    <Svg style={s.fillSvg} width={width} height={height}>
      {Array.from({ length: rows }, (_, i) => (
        <Line
          key={i}
          x1={i % 2 ? 1.5 : 0}
          y1={i * 3 + 1.5}
          x2={width}
          y2={i * 3 + 1.5}
          stroke={SECURITY_BLUE}
          strokeWidth={0.7}
          strokeLinecap="round"
          strokeDasharray="0.6 3"
          strokeOpacity={0.55}
        />
      ))}
    </Svg>
  );
}

/** Garis-garis horizontal halus (biru) — texture kotak "Jumlah Rp". */
function LineFill({ width, height }: { width: number; height: number }): React.ReactElement {
  const rows = Math.ceil(height / 3) + 1;
  return (
    <Svg style={s.fillSvg} width={width} height={height}>
      {Array.from({ length: rows }, (_, i) => (
        <Line
          key={i}
          x1={0}
          y1={i * 3 + 1.5}
          x2={width}
          y2={i * 3 + 1.5}
          stroke={SECURITY_BLUE}
          strokeWidth={0.4}
          strokeOpacity={0.4}
        />
      ))}
    </Svg>
  );
}

/**
 * Diagonal hatch biru — texture band judul "KWITANSI" (meniru guilloché kwitansi
 * asli). Garis miring 45° di-tile sepanjang lebar; step kecil biar rapat.
 */
function DiagonalFill({ width, height }: { width: number; height: number }): React.ReactElement {
  const step = 4;
  const count = Math.ceil((width + height) / step) + 1;
  return (
    <Svg style={s.fillSvg} width={width} height={height}>
      {Array.from({ length: count }, (_, i) => {
        const offset = i * step;
        return (
          <Line
            key={i}
            x1={offset}
            y1={0}
            x2={offset - height}
            y2={height}
            stroke={SECURITY_BLUE}
            strokeWidth={0.6}
            strokeOpacity={0.5}
          />
        );
      })}
    </Svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface KwitansiPdfDocumentProps {
  entry: LedgerEntry;
  logoBase64?: string | null;
}

export function KwitansiPdfDocument({ entry, logoBase64 }: KwitansiPdfDocumentProps): React.ReactElement {
  const noKwitansi =
    entry.invoiceNumber?.trim() || `KW-${entry.id.slice(0, 8).toUpperCase()}`;
  // "Untuk pembayaran" = tujuan/termin (bukan catatan) — biar tidak kembar
  // dengan KETERANGAN yang memang diambil dari catatan.
  const untukPembayaran = (
    (entry.linkedTerminLabels.length ? entry.linkedTerminLabels.join(" · ") : "") ||
    "Pembayaran"
  ).toUpperCase();
  const signer = entry.acknowledgedBy?.trim() || DEFAULT_SIGNER;
  // Keterangan diambil dari catatan transaksi (input "Catatan" saat create).
  const keterangan = entry.notes?.trim() || "—";

  return (
    <Document title={`Kwitansi ${noKwitansi}`}>
      <Page size="A5" orientation="landscape" style={s.page}>
        <View style={s.border} fixed />

        {/* ── Header ── */}
        <View style={s.header}>
          {logoBase64 ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoBase64} style={s.logo} />
          ) : (
            <View style={s.logo} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>{ORG_NAME}</Text>
            <Text style={s.orgTagline}>{ORG_TAGLINE}</Text>
            <Text style={s.orgVenue}>{ORG_VENUE}</Text>
            <Text style={s.orgAddr}>{ORG_ADDRESS}</Text>
            <Text style={s.orgAddr}>{ORG_PHONE}</Text>
            <Text style={s.orgAddr}>{ORG_EMAIL}</Text>
          </View>
        </View>

        {/* ── Title band — "KWITANSI" di atas hatch biru ── */}
        <View style={s.titleBand}>
          <DiagonalFill width={535} height={30} />
          <View style={s.titleTextWrap}>
            <Text style={s.title}>K W I T A N S I</Text>
          </View>
        </View>
        <Text style={s.nomor}>{noKwitansi}</Text>

        {/* ── Body ── */}
        <View style={s.row}>
          <Text style={s.label}>Telah terima dari</Text>
          <Text style={s.colon}>:</Text>
          <Text style={s.valueBold}>{entry.clientName}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.label}>Uang sejumlah</Text>
          <Text style={s.colon}>:</Text>
          <View style={s.uangBox}>
            <DotFill width={460} height={20} />
            <Text style={s.uangText}># {terbilangTitle(entry.amount)} #</Text>
          </View>
        </View>

        <View style={s.row}>
          <Text style={s.label}>Untuk pembayaran</Text>
          <Text style={s.colon}>:</Text>
          <Text style={s.value}>{untukPembayaran}</Text>
        </View>

        {/* ── Jumlah + tanggal ── */}
        <View style={s.bottomRow}>
          <View style={s.amountBox}>
            <LineFill width={240} height={28} />
            <Text style={s.amountLabel}>Jumlah Rp</Text>
            <Text style={s.amountValue}>{fmtAmount(entry.amount)}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={s.dateText}>
              {SIGNER_CITY}, {fmtLongDate(entry.occurredAt)}
            </Text>
          </View>
        </View>

        {/* ── Keterangan + signature ── */}
        <View style={s.footRow}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={s.ketLabel}>KETERANGAN :</Text>
            <View style={s.ketBox}>
              <Text style={s.ketText}>{keterangan}</Text>
              <Text style={s.ketText}>{KETERANGAN_DISCLAIMER}</Text>
            </View>
          </View>
          <View style={s.signCol}>
            {logoBase64 ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoBase64} style={s.signStamp} />
            ) : (
              <View style={s.signStamp} />
            )}
            <Text style={s.signName}>{signer}</Text>
            <Text style={s.signRole}>{SIGNER_ROLE}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
