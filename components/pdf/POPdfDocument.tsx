import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POPdfBooking {
  poNumber: string | null;
  bookingDate: Date;
  weddingSession: string | null;
  weddingType: string | null;
  signingLocation: string | null;
  snapCustomer: { name: string; mobileNumber: string; nikNumber?: string | null; ktpAddress?: string | null } | null;
  snapVenue: { venueName: string; address?: string | null; description?: string | null; brandName?: string | null; brandCode?: string | null } | null;
  snapPackage: { packageName: string; notes?: string | null } | null;
  snapPackageVariant: { variantName: string; pax: number; price: bigint } | null;
  snapPackageInternalItems: { id: string; itemName: string; itemDescription: string; sortOrder: number }[];
  snapPackageVendorItems: { id: string; categoryName: string; itemText: string; sortOrder: number }[];
  snapVendorItems: { id: string; vendorCategoryName: string; vendorName: string; itemName: string; itemPrice: bigint; qty: number; unit?: string | null; totalPrice: bigint; isAddons: boolean }[];
  snapBonuses: { id: string; vendorName: string; description?: string | null; qty: number }[];
  termOfPayments: { id: string; name: string; amount: bigint; dueDate: Date | null; paymentStatus: string }[];
  paymentMethod: { bankName: string; bankAccountNumber: string; bankRecipient: string } | null;
  sales: { fullName: string } | null;
  signatures: Record<string, unknown> | null;
  createdAt?: Date;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontSize: 10, fontFamily: "Helvetica", padding: 32, paddingTop: 100, paddingBottom: 120 },
  fixedHeader: { position: "absolute", top: 20, left: 32, right: 32, height: 80, flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "white", paddingBottom: 10 },
  fixedFooter: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", backgroundColor: "white", paddingTop: 10 },
  title: { fontSize: 12, fontWeight: "bold", marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 12, fontWeight: "bold", marginBottom: 4, textAlign: "center" },
  headerAddress: { fontSize: 10, textAlign: "center", marginBottom: 0, color: "#333", maxWidth: 350, alignSelf: "center" },
  sectionTitle: { fontSize: 9, fontWeight: "bold", marginVertical: 8 },
  poNumber: { fontSize: 8, fontWeight: "bold", marginBottom: 8, textAlign: "right" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 8 },
  termRow: { flexDirection: "row", marginBottom: 2, alignItems: "flex-start" },
  termNo: { width: 18, fontWeight: "bold", textAlign: "right", marginRight: 4 },
  termText: { fontSize: 8, flex: 1, textAlign: "justify" },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#000" },
  tableHeader: { flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderColor: "#000", minHeight: 20 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", minHeight: 20 },
  tableCell: { padding: 4, borderRightWidth: 1, borderColor: "#000" },
  tableCellLast: { padding: 4 },
  paymentSection: { marginBottom: 16, width: "50%" },
  paymentRow: { flexDirection: "row", height: 18 },
  paymentCell: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000", justifyContent: "center", paddingLeft: 4 },
  complimentarySection: { marginBottom: 16, width: "40%" },
  signatureSection: { flexDirection: "row", justifyContent: "space-between", marginTop: 60, marginBottom: 10 },
  signBox: { alignItems: "center", width: "30%" },
  signatureLabel: { fontSize: 9, fontWeight: "bold", marginTop: 1 },
  signerName: { fontSize: 8, fontWeight: "bold" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number | bigint | null | undefined) {
  if (n == null) return "";
  return `Rp${Number(n).toLocaleString("id-ID")}`;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

function parseInlineHtml(text: string): React.ReactNode {
  if (!text) return null;
  const cleaned = text.replace(/<\/?p>/g, "");
  if (!/<(strong|em|u|b|i)/.test(cleaned)) return stripHtml(cleaned);
  const parts: React.ReactNode[] = [];
  const regex = /<(strong|b)>([\s\S]*?)<\/\1>|<(em|i)>([\s\S]*?)<\/\3>|<u>([\s\S]*?)<\/u>/g;
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) parts.push(stripHtml(cleaned.slice(lastIndex, match.index)));
    if (match[2] !== undefined) parts.push(<Text key={k++} style={{ fontWeight: "bold" }}>{stripHtml(match[2])}</Text>);
    else if (match[4] !== undefined) parts.push(<Text key={k++} style={{ fontStyle: "italic" }}>{stripHtml(match[4])}</Text>);
    else if (match[5] !== undefined) parts.push(<Text key={k++} style={{ textDecoration: "underline" }}>{stripHtml(match[5])}</Text>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) parts.push(stripHtml(cleaned.slice(lastIndex)));
  return <>{parts}</>;
}

function parseRichText(text: string, baseFontWeight: string = "normal") {
  if (!text) return <Text style={{ fontWeight: baseFontWeight as "normal" | "bold" }} />;
  if (text.includes("<")) return parseHtmlToReactPdf(text, baseFontWeight);
  if (!text.includes("*")) return <Text style={{ fontWeight: baseFontWeight as "normal" | "bold" }}>{text}</Text>;
  const parts: React.ReactNode[] = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<Text key={k++} style={{ fontWeight: baseFontWeight as "normal" | "bold" }}>{text.slice(lastIndex, match.index)}</Text>);
    parts.push(<Text key={k++} style={{ fontWeight: "bold" }}>{match[1]}</Text>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<Text key={k++} style={{ fontWeight: baseFontWeight as "normal" | "bold" }}>{text.slice(lastIndex)}</Text>);
  return <>{parts}</>;
}

function parseHtmlToReactPdf(html: string, baseFontWeight: string = "normal"): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let k = 0;
  const hasLists = /<[ou]l>/.test(html);
  if (hasLists) {
    const listRegex = /<(ul|ol)>([\s\S]*?)<\/\1>/g;
    let lastIdx = 0;
    let listMatch;
    while ((listMatch = listRegex.exec(html)) !== null) {
      if (listMatch.index > lastIdx) {
        const before = html.slice(lastIdx, listMatch.index).replace(/<\/?p>/g, "").trim();
        if (before) elements.push(<Text key={k++} style={{ fontSize: 8, fontWeight: baseFontWeight as "normal" | "bold" }}>{parseInlineHtml(before)}</Text>);
      }
      const listType = listMatch[1];
      const items = listMatch[2].match(/<li>([\s\S]*?)<\/li>/g) || [];
      items.forEach((item, idx) => {
        const itemText = item.replace(/<\/?li>/g, "").replace(/<\/?p>/g, "").trim();
        const bullet = listType === "ol" ? `${idx + 1}. ` : "• ";
        elements.push(<View key={k++} style={{ flexDirection: "row", marginLeft: 8, marginBottom: 1 }}><Text style={{ fontSize: 8, width: listType === "ol" ? 14 : 8 }}>{bullet}</Text><Text style={{ fontSize: 8, flex: 1 }}>{parseInlineHtml(itemText)}</Text></View>);
      });
      lastIdx = listRegex.lastIndex;
    }
    if (lastIdx < html.length) {
      const after = html.slice(lastIdx).replace(/<\/?p>/g, "").trim();
      if (after) elements.push(<Text key={k++} style={{ fontSize: 8, fontWeight: baseFontWeight as "normal" | "bold" }}>{parseInlineHtml(after)}</Text>);
    }
    return <>{elements}</>;
  }
  const blocks = html.replace(/^<p>|<\/p>$/g, "").split(/<\/p>\s*<p>|<br\s*\/?>/).filter(Boolean);
  return (<Text style={{ fontSize: 8, fontWeight: baseFontWeight as "normal" | "bold" }}>{blocks.map((block, i) => { const c = block.replace(/<\/?p>/g, "").trim(); if (!c) return null; return (<React.Fragment key={i}>{i > 0 && "\n"}{parseInlineHtml(c)}</React.Fragment>); })}</Text>);
}

function renderHtmlToPdf(html: string) {
  function parseInline(text: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const regex = /<(strong|b|em|i|u)>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match;
    const tempRegex = new RegExp(regex.source, "gi");
    while ((match = tempRegex.exec(text)) !== null) {
      if (match.index > lastIndex) { const p = stripHtml(text.slice(lastIndex, match.index)); if (p) nodes.push(p); }
      const tag = match[1].toLowerCase();
      const inner = stripHtml(match[2]);
      if (inner) {
        const st: Record<string, string | number> = { fontSize: 8 };
        if (tag === "strong" || tag === "b") st.fontWeight = "bold";
        if (tag === "em" || tag === "i") st.fontStyle = "italic";
        if (tag === "u") st.textDecoration = "underline";
        nodes.push(<Text key={`${match.index}`} style={st}>{inner}</Text>);
      }
      lastIndex = tempRegex.lastIndex;
    }
    if (lastIndex < text.length) { const p = stripHtml(text.slice(lastIndex)); if (p) nodes.push(p); }
    return nodes.length > 0 ? nodes : [stripHtml(text)];
  }
  const parts: { raw: string; isBullet: boolean }[] = [];
  const hasHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!hasHtml) {
    html.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean).forEach((l) => parts.push({ raw: l, isBullet: false }));
  } else {
    const listBlocks = html.match(/<[uo]l>[\s\S]*?<\/[uo]l>/gi) || [];
    const withoutLists = html.replace(/<[uo]l>[\s\S]*?<\/[uo]l>/gi, "");
    const pMatches = [...withoutLists.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    if (pMatches.length > 0) pMatches.forEach((pm) => { const t = stripHtml(pm[1]); if (t) parts.push({ raw: pm[1], isBullet: false }); });
    for (const block of listBlocks) {
      const items = [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)];
      for (const item of items) { const t = stripHtml(item[1]); if (t) parts.push({ raw: item[1], isBullet: true }); }
    }
  }
  if (parts.length === 0) { const p = stripHtml(html); if (p) parts.push({ raw: p, isBullet: false }); }
  return (<View style={{ marginLeft: 8 }}>{parts.map((part, i) => (<Text key={i} style={{ fontSize: 8, marginBottom: 1 }}>{part.isBullet ? "• " : ""}{parseInline(part.raw)}</Text>))}</View>);
}

// ─── Build Table Rows ─────────────────────────────────────────────────────────

interface TableRow { no: string; desc: string; descBold?: boolean; total: string; isSpacer?: boolean }

function buildTableRows(booking: POPdfBooking): TableRow[] {
  const venueName = booking.snapVenue?.venueName ?? "";
  const venueFacilities = booking.snapVenue?.description ?? "";
  const packageName = booking.snapPackage?.packageName ?? "";
  const pax = booking.snapPackageVariant?.pax ?? "";
  const price = booking.snapPackageVariant ? fmtRp(booking.snapPackageVariant.price) : "";
  const notes = booking.snapPackage?.notes ? booking.snapPackage.notes.split("\n").filter(Boolean) : [];
  const internalItems = booking.snapPackageInternalItems;
  const packageVendorItems = [...booking.snapPackageVendorItems].sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: TableRow[] = [];
  rows.push({ no: "1", desc: `${venueName} ${packageName} for ${pax} people include: `, total: price });
  rows.push({ no: "", desc: "A. Ballroom Facilities", descBold: true, total: "" });
  rows.push({ no: "", desc: venueFacilities, total: "" });
  notes.forEach((note) => rows.push({ no: "", desc: note, total: "" }));

  const benefitItems = internalItems.filter((i) => i.itemName.toLowerCase().includes("benefit"));
  const nonBenefitItems = internalItems.filter((i) => !i.itemName.toLowerCase().includes("benefit"));

  if (benefitItems.length > 0) {
    benefitItems.forEach((item) => {
      rows.push({ no: "2", desc: `${item.itemName} `, descBold: true, total: "" });
      rows.push({ no: "", desc: item.itemDescription, total: "" });
      rows.push({ no: "", desc: "", total: "", isSpacer: true });
    });
  }

  let alphaCounter = 0;
  nonBenefitItems.forEach((item) => {
    const letter = String.fromCharCode(66 + alphaCounter);
    alphaCounter++;
    rows.push({ no: "", desc: `${letter}. ${item.itemName} `, descBold: true, total: "" });
    rows.push({ no: "", desc: item.itemDescription, total: "" });
    rows.push({ no: "", desc: "", total: "", isSpacer: true });
  });

  packageVendorItems.forEach((item) => {
    const letter = String.fromCharCode(66 + alphaCounter);
    alphaCounter++;
    rows.push({ no: "", desc: `${letter}. ${item.categoryName}`, descBold: true, total: "" });
    if (item.itemText.trim()) {
      if (item.itemText.includes("<")) {
        rows.push({ no: "", desc: item.itemText, total: "" });
      } else {
        item.itemText.split(";").map((t) => t.trim()).filter(Boolean).forEach((sub) => rows.push({ no: "", desc: sub, total: "" }));
      }
    }
    rows.push({ no: "", desc: "", total: "", isSpacer: true });
  });

  return rows;
}

// ─── Terms ────────────────────────────────────────────────────────────────────

function getTerms(booking: POPdfBooking): string[] {
  const brandName = booking.snapVenue?.brandName ?? "";
  const venueName = booking.snapVenue?.venueName ?? "";
  return [
    "Keseluruhan ketentuan yang tercantum di Purchase Order ini, bersifat mengikat dan wajib dilaksanakan oleh pihak penyelenggara dan penyewa.",
    "Para pihak sepakat bahwa booking fee merupakan tanda jadi dan bersifat non-refundable. Oleh karena itu, apabila terjadi pembatalan oleh Pihak Penyewa setelah pembayaran booking fee, maka dana tersebut tidak dapat dikembalikan, dan ketentuan ini telah dipahami serta disetujui oleh Pihak Penyewa tanpa adanya paksaan dari pihak manapun.",
    "Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 3 bulan atau kurang dari 3 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 50% dari dana masuk booking fee awal.",
    "Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 4 sampai 7 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 20% dari dana keseluruhan yang telah masuk.",
    "Apabila terjadi pembatalan oleh pihak penyewa dalam waktu 8 sampai 12 bulan sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 40% dari dana keseluruhan yang telah masuk.",
    "Apabila terjadi pembatalan oleh pihak penyewa dalam waktu diatas 1 tahun sebelum acara, maka dana yang dapat dikembalikan adalah sebesar 50% dari dana keseluruhan yang telah masuk.",
    "Apabila pembatalan terjadi dikarenakan calon pengantin meninggal dunia, maka dana yang telah masuk dapat dikembalikan sebesar 25% dari dana yang telah masuk.",
    "Apabila hingga sampai 1 (satu) bulan sebelum acara pernikahan berlangsung, tidak memungkinan untuk mengadakan acara karena adanya kebijakan Pemerintah, Maka kami persilahkan kepada pihak penyewa untuk reschedule acara dan memilih tanggal sesuai dengan tanggal yang masih available.",
    "Kepastian penentuan tanggal maksimal 2 (dua) minggu setelah booking fee selama tanggal yang diinginkan masih available.",
    "Perubahan atau pergeseran tanggal lebih dari 1 (satu) bulan setelah booking fee dikenakan biaya tambahan 100% dari booking fee sebesar Rp 10.000.000,- (Sepuluh Juta Rupiah).",
    "Pembayaran Down Payment kepada vendor-vendor pilihan akan dilaksanakan setelah pembayaran Angsuran 2 (masuk dana sebesar Rp 130.000.000,-)",
    "Prosesi acara Akad Nikah/Teapai dikenakan biaya sebesar Rp 5.000.000,- (lima juta rupiah).",
    "Apabila terjadi kondisi yang tidak diinginkan seperti kondisi mati lampu diluar kesalahan pihak penyelenggara seperti pemadaman listrik dari pihak PLN, kebanjiran, kebakaran, dan lainya di area sekitar yang berdampak pemadaman listrik, Pihak penyewa akan membebaskan penyelenggara dari segala tuntutan atau ganti rugi sehubungan dengan dampak dari kondisi tersebut. Pihak penyelenggara akan berupaya menggunakan genset dan mengambil tindakan yang diperlukan agar acara Pihak Penyewa pada hari - H dapat berjalan lancar.",
    `Kehilangan atau kerusakan terhadap barang yang dibawa oleh tamu undangan atau pemangku hajat pada saat pesta berlangsung bukan merupakan tanggung jawab pihak pengelola gedung (${brandName}).`,
    `Apabila ditemukan pihak keluarga atau tamu undangan yang merokok di area terlarang (Ballroom, Lobby, Ruang Rias, Backstage, Area Pubilk Indoor) maka akan dikenakan denda sebesar Rp 2.000.000,- per kejadian. Denda dibebankan kepada Pihak Client sebagai penyelenggara acara`,
    "Apabila terdapat adanya kelalaian dari Client dalam penggunaan peralatan maupun fasilitas gedung dan mengakibatkan terjadinya kerusakan pada Ballroom atau area Gedung, maka segala biaya yang timbul menjadi tanggung jawab Pihak Kedua, sebesar ; Rp.5.000.000, - / m2 (meter persegi).",
    "Diperbolehkan membawa makanan & minuman dari luar (hanya yang tidak tersedia pada vendor catering) dan akan dikenakan charge tambahan sebesar Rp 10.000,-/1 porsinya dan hanya maksimal 1 jenis makanan dengan maksimum 200 porsi.",
    `Bila terjadi kerusakan di lingkungan ${venueName} yang dikarenakan vendor tidak rekanan dengan ${brandName} atau yang diperbuat oleh pihak keluarga, menjadi tanggung jawab pihak penyewa dan akan dikompensasikan maksimal 3 (tiga) hari setelah acara berlangsung. Pihak Penyewa akan bertanggung jawab atas hal sepanjang pihak Penyelenggara dapat membuktikan bahwa kerusakan tersebut memang disebabkan oleh Pihak Penyewa. Pihak Penyelenggara akan bertanggung jawab terhadap kerusakan di lingkungan ${brandName} yang diakibatkan oleh pihak atau vendor rekanan dari pihak Penyelenggara serta akan membebaskan penyewa dari segala tuntutan atau ganti rugi sehubungan dengan kerusakan tersebut.`,
    `Untuk penambahan waktu acara dikenakan biaya per jam nya untuk acara yang menggunakan gedung ${brandName}.`,
    `Banquet Order(BO) Pemesanan makanan dari vendor catering yang diakui secara resmi adalah yang dikeluarkan oleh pihak ${brandName}.`,
    "Complimentary berupa honeymoon atau hotel dapat digunakan dengan waktu maksimal 1(satu) bulan setelah acara berlangsung.Apabila penggunaan dilakukan pada waktu high seasons maka client bersedia membayarkan additional surcharge.",
    `Seluruh complimentary tidak dapat dialihkan dalam items lain dan tidak dapat ditukarkan dalam bentuk uang.Serta berhak didapatkan oleh client apabila telah menyelesaikan pelunasan wedding package.`,
    `Demikian Surat Purchase Order ini dibuat oleh para pihak dengan keadaan sehat, tanpa paksaan dari pihak manapun. Serta mempunyai kekuatan hukum yang mengikat bagi para pihak. Apabila di kemudian hari salah satu pihak melanggar ketentuan diatas, maka Surat ini akan menjadi bukti yang sah di mata hukum. Segala perubahan terhadap Type Pembayaran dan Term & Condition akan disepakati bersama serta dituangkan dalam suatu Addendum yang merupakan bagian yang tidak terpisahkan dari Purchase Order ini.`,
    "Para Pihak dengan ini mengemban Hak dan Kewajiban sebagai berikut:",
  ];
}

// ─── Main Document ────────────────────────────────────────────────────────────

interface POPdfDocumentProps {
  booking: POPdfBooking;
  logoBase64?: string | null;
}

export function POPdfDocument({ booking, logoBase64 }: POPdfDocumentProps) {
  const tableRows = buildTableRows(booking);
  const termsList = getTerms(booking);
  const brandName = booking.snapVenue?.brandName ?? "";
  const venueName = booking.snapVenue?.venueName ?? "";
  const varSnap = booking.snapPackageVariant;
  const sigs = booking.signatures as Record<string, Record<string, string>> | null;
  const createdAt = booking.createdAt ?? new Date();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Fixed Header */}
        {logoBase64 && (
          <View style={s.fixedHeader} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoBase64} style={{ width: 180, height: 60, objectFit: "contain", alignSelf: "center" }} />
          </View>
        )}

        {/* Fixed Footer */}
        <View style={s.fixedFooter} fixed>
          <View style={{ flexDirection: "column" }}>
            <Text style={{ fontSize: 8, fontWeight: "bold", marginBottom: 1, color: "#000" }}>Kediaman Corp - Head Office</Text>
            <Text style={{ fontSize: 8, marginBottom: 1, color: "#000" }}>Jl. HR. Rasuna Said Kav. B12,</Text>
            <Text style={{ fontSize: 8, color: "#000" }}>Jakarta Selatan 12920 - Indonesia</Text>
          </View>
        </View>

        {/* Content */}
        <View>
          {/* Title */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Text style={s.title}>
              PURCHASE ORDER PACKAGE {varSnap?.pax ?? "800"} PAX - {(brandName || "BRAND NAME").toUpperCase()}
            </Text>
            <Text style={s.subtitle}>{venueName || "VENUE NAME"}</Text>
            <Text style={s.headerAddress}>{booking.snapVenue?.address ?? "-"}</Text>
          </View>

          {/* Term & Condition + PO Number */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={s.sectionTitle}>TERM & CONDITION</Text>
            <Text style={s.poNumber}>NO. PO : {booking.poNumber ?? ""}</Text>
          </View>

          {/* Terms */}
          {termsList.map((term, idx) => {
            if (idx === termsList.length - 1) {
              // Last term = Hak & Kewajiban (special)
              return (
                <View key={idx}>
                  <View style={s.termRow}>
                    <Text style={s.termNo}>{idx + 1}.</Text>
                    <Text style={s.termText}>Para Pihak dengan ini mengemban Hak dan Kewajiban sebagai berikut:</Text>
                  </View>
                  <View style={[s.termRow, { marginLeft: 20, marginTop: 4 }]}><Text style={[s.termText, { fontWeight: "bold" }]}>Penyewa</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>a)</Text><Text style={s.termText}>Berhak untuk mendapatkan fasilitas dan layanan sebagaimana yang disepakati dalam Purchase Order</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>b)</Text><Text style={s.termText}>Berhak untuk meminta konsultasi baik secara lisan ataupun tertulis sejak pembayaran Bookingfee sampai dengan acara pada Hari-H</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>c)</Text><Text style={s.termText}>Berkewajiban untuk melakukan pembayaran kepada pihak Penyelenggara sesuai dengan syarat dan ketentuan yang disepakati dalam Purchase Order</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>d)</Text><Text style={s.termText}>Berkewajiban untuk mematuhi ketentuan yang berlaku di lingkungan Penyelenggara ketika acara berlangsung.</Text></View>
                  <View style={[s.termRow, { marginLeft: 20, marginTop: 4 }]}><Text style={[s.termText, { fontWeight: "bold" }]}>Penyelenggara</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>a)</Text><Text style={s.termText}>Berhak untuk mendapatkan sejumlah pembayaran sesuai dengan syarat dan ketentuan yang disepakati dalam Purchase Order</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>b)</Text><Text style={s.termText}>Berkewajiban untuk memberikan fasilitas dan layanan kepada Penyewa sebagaimana yang disepakati dalam Purchase Order</Text></View>
                  <View style={[s.termRow, { marginLeft: 25 }]}><Text style={s.termNo}>c)</Text><Text style={s.termText}>Berkewajiban untuk memberikan informasi sebenar-benarnya terkait jumlah tamu undangan dan kesepakatan atas penambahan item pernikahan dengan pihak vendor demi kelancaran dan sukses nya penyelenggaraan acara.</Text></View>

                  {/* ATURAN PEMBAYARAN */}
                  <View style={{ marginTop: 20, marginBottom: 16 }}>
                    <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 8 }}>ATURAN PEMBAYARAN</Text>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>1. Jadwal Pembayaran</Text>
                      {booking.termOfPayments.map((t, i) => (
                        <Text key={t.id} style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>
                          • {t.name} sebesar {fmtRp(t.amount)}{t.dueDate ? ` - jatuh tempo ${new Date(t.dueDate).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}` : ""}
                        </Text>
                      ))}
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>2. Metode Pembayaran</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Untuk setiap reminder jadwal pembayaran jatuh tempo, akan dibantu oleh Finance {brandName || "Swasana"} yang akan menghubungi via telepon dan whatsapp setiap 1 minggu sebelum jatuh tempo</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Pembayaran dapat dilakukan melalui transfer bank atau tunai.</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Untuk pembayaran tunai (hanya di office representative {venueName}). Dengan membuat appointment terlebih dahulu dengan Finance Resmi, Manager Sales dan Sales.</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Untuk transfer bank, hanya melalui nomor rekening yang tercantum dalam invoice yang diterbitkan oleh Finance Resmi setiap 1 minggu sebelum jatuh tempo pembayaran terjadwal.</Text>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>3. Konfirmasi Pembayaran</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• PIC Finance Resmi untuk {venueName} : Rosita - 0811 8884 481</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Setiap Invoice akan dikirimkan oleh Finance Resmi melalui whatsapp group persiapan pernikahan.</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Setiap pembayaran harus dilengkapi dengan bukti pembayaran yang dikirim melalui whatsapp group pernikahan</Text>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>4. Pembayaran Additional Vendor</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Pihak Penyewa wajib menginformasikan terkait segala penambahan/upgrade Catering, Dekorasi dan Entertainment kepada {brandName || "Swasana"}</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Seluruh pembayaran atas penambahan charge vendor / upgrade penambahan porsi Catering / Dekorasi dan Entertainment dibayarkan setelah menerima invoice dari Finance resmi {brandName || "Swasana"}, apabila pembayaran dilakukan sebelum diberikan invoice oleh pihak Finance Resmi {brandName || "Swasana"}, maka segala konsekuensi yang timbul tidak menjadi tanggung jawab {brandName || "Swasana"}</Text>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>5. Ketentuan Lain</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Jika keterlambatan pembayaran melebihi 14 hari, layanan akan dihentikan sementara</Text>
                      <Text style={{ fontSize: 8, marginLeft: 12, marginBottom: 2 }}>• Apabila pihak penyewa tidak memberikan konfirmasi baik lisan maupun tulisan mengenai rencana tanggal pernikahan dan tidak melakukan pembayaran selama 30 hari dari tanggal invoice diterbitkan, maka pihak {brandName || "Swasana"} berhak membatalkan atau memberikan tanggal tersebut ke calon pengantin lain dan dana telah masuk dapat dikembalikan 50% dari nominal booking fee awal.</Text>
                    </View>
                  </View>
                </View>
              );
            }
            return (<View style={s.termRow} key={idx}><Text style={s.termNo}>{idx + 1}.</Text><Text style={s.termText}>{term}</Text></View>);
          })}
        </View>

        {/* Detail Section */}
        <View break>
          {/* Mini Form */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <View style={{ flexDirection: "column", gap: 4 }}>
              <Text style={{ fontSize: 9 }}>Nama : {booking.snapCustomer?.name ?? "_____________________"}</Text>
              <Text style={{ fontSize: 9 }}>No. Telp : {booking.snapCustomer?.mobileNumber ?? "_____________________"}</Text>
              <Text style={{ fontSize: 9 }}>No.KTP : {booking.snapCustomer?.nikNumber ?? "_____________________"}</Text>
              <Text style={{ fontSize: 9 }}>Alamat : {booking.snapCustomer?.ktpAddress ?? "_____________________"}</Text>
            </View>
            <View style={{ flexDirection: "column", gap: 4 }}>
              <Text style={{ fontSize: 9 }}>Acara : {booking.weddingType ? booking.weddingType.replace(/\b\w/g, (c) => c.toUpperCase()) : "Wedding Reception"}</Text>
              <Text style={{ fontSize: 9 }}>Hari/Tanggal : {new Date(booking.bookingDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</Text>
              <Text style={{ fontSize: 9 }}>Jam : {booking.weddingSession === "morning" ? "08:00-14:00" : booking.weddingSession === "evening" ? "15:30-21:00" : booking.weddingSession === "fullday" ? "08:00-21:00" : "_____________________"}</Text>
              <Text style={{ fontSize: 9 }}>Tempat : {venueName}</Text>
            </View>
          </View>

          {/* Table */}
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableCell, { width: "8%", fontWeight: "bold", fontSize: 9 }]}>NO</Text>
              <Text style={[s.tableCell, { width: "72%", fontWeight: "bold", fontSize: 9 }]}>DESCRIPTION</Text>
              <Text style={[s.tableCellLast, { width: "20%", fontWeight: "bold", fontSize: 9 }]}>Total (Rp.)</Text>
            </View>
            {(() => {
              const groups: (typeof tableRows)[] = [];
              let current: typeof tableRows = [];
              tableRows.forEach((row) => { if (row.isSpacer) { if (current.length > 0) groups.push(current); current = []; } else { current.push(row); } });
              if (current.length > 0) groups.push(current);
              return groups.map((group, gi) => {
                const noValue = group.find((r) => r.no)?.no ?? "";
                return (
                  <View key={gi} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                    <View style={{ width: "8%", borderRightWidth: 1, borderColor: "#000", justifyContent: "flex-start" }}>
                      {noValue ? <Text style={{ padding: 4, fontSize: 8 }}>{noValue}</Text> : null}
                    </View>
                    <View style={{ flex: 1, flexDirection: "column" }}>
                      {group.map((row, ri) => (
                        <View key={ri} style={{ flexDirection: "row", borderBottomWidth: ri < group.length - 1 ? 1 : 0, borderColor: "#000", minHeight: 18 }}>
                          {row.desc.includes("<ul>") || row.desc.includes("<ol>") ? (
                            <View style={{ width: "78.26%", padding: 4, borderRightWidth: 1, borderColor: "#000" }}>{parseRichText(row.desc)}</View>
                          ) : (
                            <Text style={{ width: "78.26%", padding: 4, borderRightWidth: 1, borderColor: "#000", fontWeight: row.descBold ? "bold" : "normal", fontSize: 8 }}>{row.descBold ? row.desc : parseRichText(row.desc)}</Text>
                          )}
                          <Text style={{ width: "21.74%", padding: 4, fontSize: 8 }}>{row.total}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              });
            })()}
          </View>

          {/* Complimentary + Payment */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 8 }}>
            {booking.snapBonuses.length > 0 && (
              <View style={s.complimentarySection}>
                <Text style={{ fontWeight: "bold", fontSize: 8, color: "red", marginBottom: 4 }}>*Complimentary :</Text>
                <View style={{ marginLeft: 8 }}>
                  {booking.snapBonuses.map((b) => (
                    <View key={b.id} style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 8, fontWeight: "bold" }}>{b.vendorName}</Text>
                      {b.description ? renderHtmlToPdf(b.description) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={[s.paymentSection, { marginLeft: "auto" }]}>
              <View style={s.paymentRow}>
                <View style={[s.paymentCell, { width: "60%" }]}><Text style={{ fontWeight: "bold", fontSize: 8 }}>Total Payment</Text></View>
                <View style={[s.paymentCell, { flex: 1 }]}><Text style={{ fontSize: 8 }}>{varSnap ? fmtRp(varSnap.price) : ""}</Text></View>
              </View>
              <View style={s.paymentRow}>
                <View style={[s.paymentCell, { width: "60%" }]}><Text style={{ fontWeight: "bold", fontSize: 8 }}>Booking fee via {booking.paymentMethod?.bankName ?? ""} {new Date(createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</Text></View>
                <View style={[s.paymentCell, { flex: 1 }]}><Text style={{ fontSize: 8 }}>{(() => { const bf = booking.termOfPayments.find((t) => t.name === "Booking Fee"); return bf ? fmtRp(bf.amount) : ""; })()}</Text></View>
              </View>
            </View>
          </View>

          {/* Closing + Signature */}
          <View wrap={false}>
            <Text style={{ fontSize: 8, marginLeft: 20, marginBottom: 10 }}>
              Demikian Surat Purchase Order ini dibuat oleh pihak penyewa dan penyelenggara dengan keadaan sehat, tanpa paksaan dari pihak manapun. Serta mempunyai kekuatan mengikat satu dengan lainnya. Apabila dikemudian hari salah satu pihak melanggar sesuai dengan ketentuan diatas, maka perjanjian ini menjadi bukti yang sah dan sempurna di mata hukum.
            </Text>
            <Text style={{ fontSize: 8, marginTop: 10, marginLeft: 20 }}>
              {booking.signingLocation ?? "_______________"}, {new Date(createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
            </Text>
            <View style={s.signatureSection}>
              <View style={s.signBox}>
                {sigs?.client?.signature ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image src={sigs.client.signature} style={{ width: 100, height: 50, marginBottom: 4 }} />
                ) : (
                  <View style={{ width: 100, height: 50, marginBottom: 4 }} />
                )}
                <Text style={s.signerName}>({booking.snapCustomer?.name ?? ""})</Text>
                <Text style={s.signatureLabel}>Client</Text>
              </View>
              <View style={s.signBox}>
                {sigs?.sales?.signature ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image src={sigs.sales.signature} style={{ width: 100, height: 50, marginBottom: 4 }} />
                ) : (
                  <View style={{ width: 100, height: 50, marginBottom: 4 }} />
                )}
                <Text style={s.signerName}>({sigs?.sales?.name ?? booking.sales?.fullName ?? ""})</Text>
                <Text style={s.signatureLabel}>Event Specialist</Text>
              </View>
              <View style={s.signBox}>
                {sigs?.manager?.signature ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image src={sigs.manager.signature as string} style={{ width: 100, height: 50, marginBottom: 4 }} />
                ) : (
                  <View style={{ width: 100, height: 50, marginBottom: 4 }} />
                )}
                <Text style={s.signerName}>({sigs?.manager?.name as string ?? ""})</Text>
                <Text style={s.signatureLabel}>Head of Marketing</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
