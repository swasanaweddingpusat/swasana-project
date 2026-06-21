import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POPdfBooking {
  poNumber: string | null;
  bookingDate: Date;
  weddingSession: string | null;
  weddingType: string | null;
  eventTime?: string | null;
  signingLocation: string | null;
  snapCustomer: { name: string; mobileNumber: string; cppNik?: string | null; cpwNik?: string | null; ktpAddress?: string | null; cppAddress?: string | null; cpwAddress?: string | null; emailCpp?: string | null; emailCpw?: string | null } | null;
  snapVenue: { venueName: string; address?: string | null; description?: string | null; brandName?: string | null; brandCode?: string | null } | null;
  snapPackage: { packageName: string; notes?: string | null } | null;
  snapPackagePricing: { packageName: string; pax: number; price: number } | null;
  snapPackageInternalItems: { id: string; itemName: string; itemDescription: string; sortOrder: number }[];
  snapPackageVendorItems: { id: string; categoryName: string; itemText: string; sortOrder: number; isTakeout?: boolean }[];
  snapPackageCategoryPrices?: { categoryName: string; basePrice: number; isTakeout: boolean }[];
  snapVendorItems: { id: string; vendorCategoryName: string; vendorName: string; itemName: string; itemPrice: number; qty: number; unit?: string | null; totalPrice: number; isAddons: boolean }[];
  snapBonuses: { id: string; vendorName: string; description?: string | null; qty: number }[];
  snapComplimentaries?: { id: string; name: string; description?: string | null; price: number; isShowPrice: boolean; qty: number }[];
  termOfPayments: { id: string; name: string; amount: number; dueDate: Date | null; paymentStatus: string }[];
  paymentMethod: { bankName: string; bankAccountNumber: string; bankRecipient: string } | null;
  sales: { fullName: string } | null;
  manager?: { fullName: string | null } | null;
  signatures: { client?: { signature: string }; roles?: { signature?: string; name: string; title: string }[] } | null;
  createdAt?: Date;
  discountName?: string | null;
  discountAmount?: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontSize: 10, fontFamily: "Helvetica", padding: 32, paddingTop: 84, paddingBottom: 120 },
  fixedHeader: { position: "absolute", top: 20, left: 32, right: 32, height: 64, flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "white", paddingBottom: 8 },
  fixedFooter: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", backgroundColor: "white", paddingTop: 10 },
  title: { fontSize: 9, fontWeight: "bold", marginBottom: 3, textAlign: "center" },
  subtitle: { fontSize: 9, fontWeight: "bold", marginBottom: 3, textAlign: "center" },
  headerAddress: { fontSize: 8, textAlign: "center", marginBottom: 0, color: "#333", maxWidth: 350, alignSelf: "center" },
  sectionTitle: { fontSize: 7, fontWeight: "bold", marginVertical: 8 },
  poNumber: { fontSize: 7, fontWeight: "bold", marginBottom: 8, textAlign: "right" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 8 },
  termRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  termNo: { width: 18, fontWeight: "bold", textAlign: "right", marginRight: 4, fontSize: 8 },
  termText: { fontSize: 8, flex: 1, textAlign: "justify" },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#000" },
  tableHeader: { flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderColor: "#000", minHeight: 14 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", minHeight: 14 },
  tableCell: { padding: 2, borderRightWidth: 1, borderColor: "#000" },
  tableCellLast: { padding: 2 },
  paymentSection: { marginBottom: 16, width: "50%" },
  paymentRow: { flexDirection: "row", height: 18 },
  paymentCell: { borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000", justifyContent: "center", paddingLeft: 4 },
  complimentarySection: { marginBottom: 8 },
  signatureSection: { flexDirection: "row", justifyContent: "space-between", marginTop: 60, marginBottom: 10 },
  signBox: { alignItems: "center", width: "30%" },
  signatureLabel: { fontSize: 9, fontWeight: "bold", marginTop: 1 },
  signerName: { fontSize: 8, fontWeight: "bold" },
  infoRow: { flexDirection: "row", alignItems: "flex-start" },
  infoLabel: { fontSize: 7, width: 72 },
  infoLabelRight: { fontSize: 7, width: 78 },
  infoValue: { fontSize: 7, flex: 1 },
  detailRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000", minHeight: 14 },
  detailColNo: { width: "5%", fontSize: 7, padding: 2, borderRightWidth: 1, borderColor: "#000" },
  detailColLabel: { width: "30%", fontSize: 7, padding: 2, borderRightWidth: 1, borderColor: "#000" },
  detailColValue: { flex: 1, fontSize: 7, padding: 2 },
  // 2-column info table (label : value per side) — borderless, plain label
  infoPairRow: { flexDirection: "row", marginBottom: 1, alignItems: "flex-start" },
  infoPairLabel: { width: 48, fontSize: 7, fontWeight: "bold", paddingVertical: 0, marginRight: 2 },
  infoPairValue: { flex: 1, fontSize: 7, paddingVertical: 0 },
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

function parseRichText(text: string, baseFontWeight: string = "normal", fontSize: number = 8) {
  if (!text) return <Text style={{ fontWeight: baseFontWeight as "normal" | "bold", fontSize }} />;
  if (text.includes("<")) return parseHtmlToReactPdf(text, baseFontWeight, fontSize);
  if (!text.includes("*")) return <Text style={{ fontWeight: baseFontWeight as "normal" | "bold", fontSize }}>{text}</Text>;
  const parts: React.ReactNode[] = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<Text key={k++} style={{ fontWeight: baseFontWeight as "normal" | "bold", fontSize }}>{text.slice(lastIndex, match.index)}</Text>);
    parts.push(<Text key={k++} style={{ fontWeight: "bold", fontSize }}>{match[1]}</Text>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<Text key={k++} style={{ fontWeight: baseFontWeight as "normal" | "bold", fontSize }}>{text.slice(lastIndex)}</Text>);
  return <>{parts}</>;
}

function parseHtmlToReactPdf(html: string, baseFontWeight: string = "normal", fontSize: number = 8): React.ReactNode {
  let k = 0;

  function renderList(listHtml: string, type: "ol" | "ul", depth: number, startNum: number = 1): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    // Use a stack-based approach to find top-level <li> items
    const items: string[] = [];
    let remaining = listHtml;
    while (remaining.length > 0) {
      const liStart = remaining.indexOf("<li>");
      if (liStart === -1) break;
      let level = 1;
      let pos = liStart + 4;
      while (level > 0 && pos < remaining.length) {
        const nextOpen = remaining.indexOf("<li>", pos);
        const nextClose = remaining.indexOf("</li>", pos);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) { level++; pos = nextOpen + 4; }
        else { level--; if (level === 0) { items.push(remaining.slice(liStart + 4, nextClose)); remaining = remaining.slice(nextClose + 5); } else { pos = nextClose + 5; } }
      }
      if (level > 0) break;
    }

    items.forEach((itemContent, idx) => {
      // Check for nested <ul> or <ol>
      const nestedListMatch = itemContent.match(/<(ul|ol)(?:\s[^>]*)?>([\s\S]*)<\/\1>/i);
      let mainText = itemContent;
      let nestedNodes: React.ReactNode[] = [];

      if (nestedListMatch) {
        mainText = itemContent.slice(0, nestedListMatch.index).replace(/<\/?p>/g, "").trim();
        const nestedStartMatch = nestedListMatch[0].match(/start="(\d+)"/);
        const nestedStart = nestedStartMatch ? parseInt(nestedStartMatch[1]) : 1;
        nestedNodes = renderList(nestedListMatch[2], nestedListMatch[1] as "ol" | "ul", depth + 1, nestedStart);
      } else {
        mainText = mainText.replace(/<\/?p>/g, "").trim();
      }

      const bullet = type === "ol" ? `${idx + startNum}. ` : "• ";
      const indent = depth * 16;

      if (mainText) {
        nodes.push(
          <View key={k++} wrap={depth === 0 ? false : undefined} style={{ flexDirection: "row", marginLeft: indent, marginBottom: depth === 0 ? 2 : 1 }}>
            <Text style={{ fontSize, width: type === "ol" ? 18 : 10, lineHeight: 1.3 }}>{bullet}</Text>
            <Text style={{ fontSize, flex: 1, lineHeight: 1.3 }}>{parseInlineHtml(mainText)}</Text>
          </View>
        );
      }

      if (nestedNodes.length > 0) {
        // Push nested bullet nodes directly into the parent array (no wrapper View).
        // A wrapper <View> caused react-pdf to treat the entire nested list as a single
        // layout block, collapsing all bullets after the first into a single row.
        // Flattening lets react-pdf render each bullet as its own vertical block.
        for (const node of nestedNodes) {
          nodes.push(node);
        }
      }
    });

    return nodes;
  }

  const elements: React.ReactNode[] = [];
  const hasLists = /<[ou]l[\s>]/.test(html);

  if (hasLists) {
    // Split by top-level lists (support <ol start="N"> attributes)
    const segments: { type: "text" | "list"; content: string; listType?: "ol" | "ul"; start?: number }[] = [];
    let temp = html;
    while (temp.length > 0) {
      const olMatch = temp.match(/<ol(\s[^>]*)?>/) ;
      const ulIdx = temp.indexOf("<ul>");
      const olIdx = olMatch ? temp.indexOf(olMatch[0]) : -1;
      let nextIdx = -1;
      let tag: "ol" | "ul" = "ol";
      let startNum = 1;
      let openTagLen = 4; // "<ol>" or "<ul>"
      if (olIdx === -1 && ulIdx === -1) { if (temp.trim()) segments.push({ type: "text", content: temp }); break; }
      if (olIdx === -1) { nextIdx = ulIdx; tag = "ul"; openTagLen = 4; }
      else if (ulIdx === -1) { nextIdx = olIdx; tag = "ol"; openTagLen = olMatch![0].length; const sm = olMatch![1]?.match(/start="(\d+)"/); if (sm) startNum = parseInt(sm[1]); }
      else if (olIdx < ulIdx) { nextIdx = olIdx; tag = "ol"; openTagLen = olMatch![0].length; const sm = olMatch![1]?.match(/start="(\d+)"/); if (sm) startNum = parseInt(sm[1]); }
      else { nextIdx = ulIdx; tag = "ul"; openTagLen = 4; }

      if (nextIdx > 0) segments.push({ type: "text", content: temp.slice(0, nextIdx) });

      // Find matching close tag (balanced)
      const closeTag = `</${tag}>`;
      let level = 1;
      let pos = nextIdx + openTagLen;
      while (level > 0 && pos < temp.length) {
        const openTagSimple = `<${tag}`;
        const nOpenIdx = temp.indexOf(openTagSimple, pos);
        const nClose = temp.indexOf(closeTag, pos);
        if (nClose === -1) break;
        if (nOpenIdx !== -1 && nOpenIdx < nClose) { level++; pos = nOpenIdx + openTagSimple.length + 1; }
        else { level--; pos = nClose + closeTag.length; }
      }
      const listContent = temp.slice(nextIdx + openTagLen, pos - closeTag.length);
      segments.push({ type: "list", content: listContent, listType: tag, start: startNum });
      temp = temp.slice(pos);
    }

    for (const seg of segments) {
      if (seg.type === "text") {
        const clean = seg.content.replace(/<\/?p>/g, "").trim();
        if (clean) elements.push(<Text key={k++} style={{ fontSize, fontWeight: baseFontWeight as "normal" | "bold", marginTop: 10 }}>{parseInlineHtml(clean)}</Text>);
      } else {
        elements.push(<View key={k++}>{renderList(seg.content, seg.listType!, 0, seg.start ?? 1)}</View>);
      }
    }
    return <>{elements}</>;
  }

  const blocks = html.replace(/^<p>|<\/p>$/g, "").split(/<\/p>\s*<p>|<br\s*\/?>/).filter(Boolean);
  return (<Text style={{ fontSize, fontWeight: baseFontWeight as "normal" | "bold" }}>{blocks.map((block, i) => { const c = block.replace(/<\/?p>/g, "").trim(); if (!c) return null; return (<React.Fragment key={i}>{i > 0 && "\n"}{parseInlineHtml(c)}</React.Fragment>); })}</Text>);
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
  return (<View style={{ marginLeft: 8 }}>{parts.map((part, i) => (<Text key={i} style={{ fontSize: 7, marginBottom: 1 }}>{part.isBullet ? "• " : ""}{parseInline(part.raw)}</Text>))}</View>);
}

// ─── Build Table Rows ─────────────────────────────────────────────────────────

interface TableRow { no: string; desc: string; descBold?: boolean; total: string; isSpacer?: boolean; isTakeout?: boolean }

function buildTableRows(booking: POPdfBooking): TableRow[] {
  const venueName = booking.snapVenue?.venueName ?? "";
  const packageName = booking.snapPackage?.packageName ?? "";
  const pricingPackageName = booking.snapPackagePricing?.packageName ?? "";
  const pax = booking.snapPackagePricing?.pax ?? "";
  const price = booking.snapPackagePricing ? fmtRp(booking.snapPackagePricing.price) : "";
  const notes = booking.snapPackage?.notes ? booking.snapPackage.notes.split("\n").filter(Boolean) : [];
  const internalItems = [...booking.snapPackageInternalItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const packageVendorItems = [...booking.snapPackageVendorItems].sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: TableRow[] = [];
  // Only append the pricing tier name when it differs from the package name,
  // otherwise it duplicates (e.g. "PRIORITY - PRIORITY").
  const tierSuffix = pricingPackageName && pricingPackageName !== packageName ? ` - ${pricingPackageName}` : "";
  rows.push({ no: "1", desc: `${venueName} ${packageName}${tierSuffix} for ${pax} people include: `, total: price });
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

  // Merge non-benefit internal items + vendor items, sort by sortOrder
  type MergedItem = { type: "internal"; itemName: string; itemDescription: string; sortOrder: number } | { type: "vendor"; categoryName: string; itemText: string; sortOrder: number; isTakeout: boolean };
  const mergedItems: MergedItem[] = [
    ...nonBenefitItems.map((i) => ({ type: "internal" as const, itemName: i.itemName, itemDescription: i.itemDescription, sortOrder: i.sortOrder })),
    ...packageVendorItems.map((i) => ({ type: "vendor" as const, categoryName: i.categoryName, itemText: i.itemText, sortOrder: i.sortOrder, isTakeout: i.isTakeout ?? false })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  let alphaCounter = 0;
  mergedItems.forEach((item) => {
    const letter = String.fromCharCode(66 + alphaCounter);
    alphaCounter++;
    if (item.type === "internal") {
      rows.push({ no: "", desc: `${letter}. ${item.itemName} `, descBold: true, total: "" });
      rows.push({ no: "", desc: item.itemDescription, total: "" });
      rows.push({ no: "", desc: "", total: "", isSpacer: true });
    } else {
      const catTakeout = item.isTakeout;
      rows.push({ no: "", desc: `${letter}. ${item.categoryName}${catTakeout ? " (TAKEOUT)" : ""}`, descBold: true, total: "", isTakeout: catTakeout });
      if (item.itemText.trim()) {
        if (item.itemText.includes("<")) {
          rows.push({ no: "", desc: item.itemText, total: "", isTakeout: catTakeout });
        } else {
          item.itemText.split("\n").filter(Boolean).forEach((line) => rows.push({ no: "", desc: `   ${line}`, total: "", isTakeout: catTakeout }));
        }
      }
      rows.push({ no: "", desc: "", total: "", isSpacer: true });
    }
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

// ─── Variable Replacement ─────────────────────────────────────────────────────

function terbilang(n: number): string {
  const satuan = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + " Belas";
  if (n < 100) return satuan[Math.floor(n / 10)] + " Puluh" + (n % 10 ? " " + satuan[n % 10] : "");
  if (n < 200) return "Seratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 1000) return satuan[Math.floor(n / 100)] + " Ratus" + (n % 100 ? " " + terbilang(n % 100) : "");
  if (n < 2000) return "Seribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " Ribu" + (n % 1000 ? " " + terbilang(n % 1000) : "");
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + " Juta" + (n % 1000000 ? " " + terbilang(n % 1000000) : "");
  return terbilang(Math.floor(n / 1000000000)) + " Miliar" + (n % 1000000000 ? " " + terbilang(n % 1000000000) : "");
}

function fmtRpTerbilang(amount: number): string {
  return `Rp ${Number(amount).toLocaleString("id-ID")},-  (${terbilang(amount)} Rupiah)`;
}

function replaceVariables(html: string, booking: POPdfBooking): string {
  const vars: Record<string, string> = {
    venue: booking.snapVenue?.brandName ?? "",
    venue_location: booking.snapVenue?.venueName ?? "",
    customer_name: booking.snapCustomer?.name ?? "",
    booking_date: new Date(booking.bookingDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" }),
    po_number: booking.poNumber ?? "",
    wedding_type: booking.weddingType ? booking.weddingType.replace(/\b\w/g, (c) => c.toUpperCase()) : "",
    package_name: booking.snapPackage?.packageName ?? "",
    package_price: booking.snapPackagePricing ? fmtRp(booking.snapPackagePricing.price) : "",
    discount_amount: fmtRp(booking.discountAmount ?? 0),
    booking_fee: (() => { const bf = booking.termOfPayments[0]; return bf ? fmtRp(bf.amount) : ""; })(),
    total_paid: fmtRp(booking.termOfPayments.filter((t) => t.paymentStatus === "paid").reduce((sum, t) => sum + t.amount, 0)),
    remaining_balance: fmtRp(booking.termOfPayments.filter((t) => t.paymentStatus !== "paid").reduce((sum, t) => sum + t.amount, 0)),
    sales_name: booking.sales?.fullName ?? "",
    manager_name: booking.manager?.fullName ?? "",
    brand_name: booking.snapVenue?.brandName ?? "",
  };

  // Replace {term_of_payment} with formatted list: "Nama sebesar Rp X,- (Terbilang)"
  if (html.includes("{term_of_payment}")) {
    const topHtml = booking.termOfPayments.map((t) => {
      const due = t.dueDate ? ` - jatuh tempo ${new Date(t.dueDate).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" })}` : "";
      return `<li>${t.name} sebesar ${fmtRpTerbilang(t.amount)}${due}</li>`;
    }).join("");

    // Editor format: <ul><li><p>{term_of_payment}</p></li></ul>
    // Strip the <li><p>…</p></li> wrapper and inject raw payment items directly into the <ul>.
    // Resilient to optional whitespace/newlines between tags and around the placeholder.
    html = html.replace(/<li>\s*<p>\s*\{term_of_payment\}\s*<\/p>\s*<\/li>/g, topHtml);
    // Seeder format: <ul>{term_of_payment}</ul> — placeholder sits bare inside <ul>
    html = html.replace(/\{term_of_payment\}/g, topHtml);
  }

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return html;
}

// ─── Main Document ────────────────────────────────────────────────────────────

interface POPdfDocumentProps {
  booking: POPdfBooking;
  logoBase64?: string | null;
  termAndConditionHtml?: string | null;
  ematerai?: { sn: string; qrBase64: string } | null;
  previewMode?: boolean;
}

export function POPdfDocument({ booking, logoBase64, termAndConditionHtml, ematerai, previewMode }: POPdfDocumentProps) {
  const tableRows = buildTableRows(booking);
  const termsList = getTerms(booking);
  const resolvedTcHtml = termAndConditionHtml
    ? previewMode
      ? termAndConditionHtml
      : replaceVariables(termAndConditionHtml, booking)
    : null;
  const brandName = booking.snapVenue?.brandName ?? "";
  const venueName = booking.snapVenue?.venueName ?? "";
  const varSnap = booking.snapPackagePricing;
  const sigs = booking.signatures;
  const createdAt = booking.createdAt ?? new Date();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Fixed Header */}
        {logoBase64 && (
          <View style={s.fixedHeader} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoBase64} style={{ width: 150, height: 48, objectFit: "contain", alignSelf: "center" }} />
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
            <Text style={s.title}>PURCHASE ORDER PACKAGE</Text>
            <Text style={s.title}>{varSnap?.packageName ? `${varSnap.packageName.toUpperCase()} ` : ""}{varSnap?.pax ?? "800"} PAX - {(brandName || "BRAND NAME").toUpperCase()}</Text>
            <Text style={s.subtitle}>{venueName || "VENUE NAME"}</Text>
            <Text style={s.headerAddress}>{booking.snapVenue?.address ?? "-"}</Text>
          </View>

          {/* Term & Condition + PO Number */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={s.sectionTitle}>TERM & CONDITION</Text>
            <Text style={s.poNumber}>NO. PO : {booking.poNumber ?? ""}</Text>
          </View>

          {/* Terms — dynamic from venue T&C or hardcoded fallback */}
          {resolvedTcHtml ? (
            <View>{parseHtmlToReactPdf(resolvedTcHtml)}</View>
          ) : (
            termsList.map((term, idx) => (
              <View style={s.termRow} key={idx}>
                <Text style={s.termNo}>{idx + 1}.</Text>
                <Text style={s.termText}>{term}</Text>
              </View>
            ))
          )}

          {/* Detail Section — tabel 2 kolom data; mulai halaman baru (break), gak kepotong, tanpa border */}
          <View break wrap={false} style={{ marginTop: 0, marginBottom: 8 }}>
            {(() => {
              const phone = (() => {
                const raw = booking.snapCustomer?.mobileNumber;
                if (!raw) return "-";
                try {
                  const arr = JSON.parse(raw) as { name?: string; number: string }[];
                  if (Array.isArray(arr)) return arr.map((e) => (e.name ? `${e.number} (${e.name})` : e.number)).join(", ");
                } catch { /* not JSON */ }
                return raw;
              })();
              const acara = (() => {
                const map: Record<string, string> = { R: "Resepsi", AR: "Akad & Resepsi", TR: "Teapai & Resepsi", PR: "Pemberkatan Resepsi", VO: "Venue Only" };
                return booking.weddingType ? (map[booking.weddingType] ?? booking.weddingType) : "Wedding Reception";
              })();
              // Prefer the user-entered eventTime (e.g. "07.30 - 13.00"); only fall back to
              // the session default when no explicit time was provided.
              const sessionJam = booking.weddingSession === "morning" ? "08:00-14:00" : booking.weddingSession === "evening" ? "15:30-21:00" : booking.weddingSession === "fullday" ? "08:00-21:00" : "-";
              const jam = booking.eventTime?.trim() ? booking.eventTime.trim() : sessionJam;
              const tanggal = new Date(booking.bookingDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" });
              // Gabung nilai CPP & CPW jadi satu baris: "<cpp> (cpp), <cpw> (cpw)".
              // Hanya sertakan sisi yang ada datanya; kalau dua-duanya kosong → "-".
              const joinCppCpw = (cpp?: string | null, cpw?: string | null) => {
                const parts: string[] = [];
                if (cpp?.trim()) parts.push(`${cpp.trim()} (cpp)`);
                if (cpw?.trim()) parts.push(`${cpw.trim()} (cpw)`);
                return parts.length > 0 ? parts.join(", ") : "-";
              };
              const ktp = joinCppCpw(booking.snapCustomer?.cppNik, booking.snapCustomer?.cpwNik);
              const email = joinCppCpw(booking.snapCustomer?.emailCpp, booking.snapCustomer?.emailCpw);
              // Kolom kiri: data customer. Kolom kanan: detail acara.
              const leftItems: { label: string; value: string }[] = [
                { label: "Nama", value: booking.snapCustomer?.name ?? "-" },
                { label: "No. Telp", value: phone },
                { label: "Email", value: email },
                { label: "No. KTP", value: ktp },
                { label: "Alamat CPP", value: booking.snapCustomer?.cppAddress ?? "-" },
                { label: "Alamat CPW", value: booking.snapCustomer?.cpwAddress ?? "-" },
              ];
              const rightItems: { label: string; value: string }[] = [
                { label: "Acara", value: acara },
                { label: "Hari/Tanggal", value: tanggal },
                { label: "Jam", value: jam },
                { label: "Tempat", value: venueName },
              ];
              // Render satu sisi panel sebagai daftar baris label | value.
              const renderSide = (rows: { label: string; value: string }[]) => (
                <>
                  {rows.map((it, i) => (
                    <View key={i} style={s.infoPairRow}>
                      <Text style={s.infoPairLabel}>{it.label}</Text>
                      <Text style={s.infoPairValue}>: {it.value}</Text>
                    </View>
                  ))}
                </>
              );
              return (
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>{renderSide(leftItems)}</View>
                  <View style={{ flex: 1, paddingLeft: 12 }}>{renderSide(rightItems)}</View>
                </View>
              );
            })()}
          </View>

          {/* Tabel paket — ngalir natural (tanpa break), boleh lintas halaman biar gak overflow */}
          <View>
            {/* Table Header */}
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableCell, { width: "5%", fontWeight: "bold", fontSize: 7 }]}>NO</Text>
                <Text style={[s.tableCell, { width: "75%", fontWeight: "bold", fontSize: 7 }]}>DESCRIPTION</Text>
                <Text style={[s.tableCellLast, { width: "20%", fontWeight: "bold", fontSize: 7 }]}>Total (Rp.)</Text>
              </View>
            </View>

          {/* Table Body */}
          <View style={{ borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#000" }}>
            {(() => {
              const groups: (typeof tableRows)[] = [];
              let current: typeof tableRows = [];
              tableRows.forEach((row) => { if (row.isSpacer) { if (current.length > 0) groups.push(current); current = []; } else { current.push(row); } });
              if (current.length > 0) groups.push(current);
              return groups.map((group, gi) => {
                const noValue = group.find((r) => r.no)?.no ?? "";
                const totalValue = group.find((r) => r.total)?.total ?? "";
                return (
                  <View key={gi} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                    {/* NO — pinned to top of the group */}
                    <View style={{ width: "5%", borderRightWidth: 1, borderColor: "#000", justifyContent: "flex-start" }}>
                      {noValue ? <Text style={{ padding: 2, fontSize: 7 }}>{noValue}</Text> : null}
                    </View>
                    {/* DESCRIPTION — stacked rows */}
                    <View style={{ width: "75%", flexDirection: "column", borderRightWidth: 1, borderColor: "#000" }}>
                      {group.map((row, ri) => (
                        <View key={ri} style={{ flexDirection: "row", borderBottomWidth: ri < group.length - 1 ? 1 : 0, borderColor: "#000", minHeight: 14 }}>
                          {row.desc.includes("<ul>") || row.desc.includes("<ol>") ? (
                            <View style={{ flex: 1, padding: 2, ...(row.isTakeout ? { opacity: 0.4 } : {}) }}>{parseRichText(row.desc, "normal", 7)}</View>
                          ) : (
                            <Text style={{ flex: 1, padding: 2, fontWeight: row.descBold ? "bold" : "normal", fontSize: 7, textDecoration: row.isTakeout ? "line-through" : "none", color: row.isTakeout ? "#999" : "#000" }}>{row.descBold ? row.desc : parseRichText(row.desc, "normal", 7)}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                    {/* TOTAL — pinned to top of the group */}
                    <View style={{ width: "20%", justifyContent: "flex-start" }}>
                      {totalValue ? <Text style={{ padding: 2, fontSize: 7 }}>{totalValue}</Text> : null}
                    </View>
                  </View>
                );
              });
            })()}
          </View>
          </View>

          {/* Complimentary — table full-width (No | Complimentary | Harga) */}
          {(booking.snapComplimentaries ?? []).length > 0 ? (
            (() => {
              const compItems = booking.snapComplimentaries!;
              // Hide the price column entirely when NO item has isShowPrice === true
              const showPriceCol = compItems.some((c) => c.isShowPrice);
              const colNo = "6%";
              const colName = showPriceCol ? "74%" : "94%";
              const colPrice = "20%";
              return (
                <View wrap={false} style={[s.complimentarySection, { marginTop: 16 }]}>
                  <Text style={{ fontWeight: "bold", fontSize: 7, color: "red", marginBottom: 4 }}>*Complimentary :</Text>
                  <View style={{ borderWidth: 1, borderColor: "#000" }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderColor: "#000" }}>
                      <Text style={{ width: colNo, fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>No</Text>
                      <Text style={showPriceCol
                        ? { width: colName, fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }
                        : { width: colName, fontSize: 6, fontWeight: "bold", padding: 2 }
                      }>Complimentary</Text>
                      {showPriceCol && (
                        <Text style={{ width: colPrice, fontSize: 6, fontWeight: "bold", padding: 2 }}>Harga</Text>
                      )}
                    </View>
                    {/* Rows */}
                    {compItems.map((c, idx) => (
                      <View
                        key={c.id}
                        style={idx < compItems.length - 1
                          ? { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }
                          : { flexDirection: "row" }
                        }
                      >
                        <Text style={{ width: colNo, fontSize: 6, padding: 2, borderRightWidth: 1, borderColor: "#000" }}>{idx + 1}</Text>
                        <View style={showPriceCol
                          ? { width: colName, padding: 2, borderRightWidth: 1, borderColor: "#000" }
                          : { width: colName, padding: 2 }
                        }>
                          <Text style={{ fontSize: 6, fontWeight: "bold" }}>{c.name}</Text>
                          {c.description ? renderHtmlToPdf(c.description) : null}
                        </View>
                        {showPriceCol && (
                          <Text style={{ width: colPrice, fontSize: 6, padding: 2 }}>
                            {c.isShowPrice ? fmtRp(c.price) : ""}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()
          ) : booking.snapBonuses.length > 0 ? (
            <View wrap={false} style={[s.complimentarySection, { marginTop: 16 }]}>
              <Text style={{ fontWeight: "bold", fontSize: 7, color: "red", marginBottom: 4 }}>*Complimentary :</Text>
              {/* Table — legacy snapBonuses (no price, no qty) */}
              <View style={{ borderWidth: 1, borderColor: "#000" }}>
                {/* Header */}
                <View style={{ flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderColor: "#000" }}>
                  <Text style={{ width: "6%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>No</Text>
                  <Text style={{ width: "94%", fontSize: 6, fontWeight: "bold", padding: 2 }}>Complimentary</Text>
                </View>
                {/* Rows */}
                {booking.snapBonuses.map((b, idx) => (
                  <View
                    key={b.id}
                    style={idx < booking.snapBonuses.length - 1
                      ? { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }
                      : { flexDirection: "row" }
                    }
                  >
                    <Text style={{ width: "6%", fontSize: 6, padding: 2, borderRightWidth: 1, borderColor: "#000" }}>{idx + 1}</Text>
                    <View style={{ width: "94%", padding: 2 }}>
                      <Text style={{ fontSize: 6, fontWeight: "bold" }}>{b.vendorName}</Text>
                      {b.description ? renderHtmlToPdf(b.description) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Payment Summary — table full-width, header SUMMARY PAYMENT | NOMINAL; mulai halaman baru (break) */}
          <View break wrap={false} style={{ marginBottom: 8, borderWidth: 1, borderColor: "#000" }}>
            {/* Header */}
            <View style={{ flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderColor: "#000" }}>
              <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>SUMMARY PAYMENT</Text>
              <Text style={{ width: "30%", fontSize: 6, fontWeight: "bold", padding: 2 }}>NOMINAL</Text>
            </View>
            {/* Total Payment */}
            <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
              <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>Total Payment</Text>
              <Text style={{ width: "30%", fontSize: 6, padding: 2 }}>{varSnap ? fmtRp(varSnap.price) : ""}</Text>
            </View>
            {/* Discount (conditional) */}
            {(booking.discountAmount ?? 0) > 0 && (
              <>
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                  <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000", color: "red" }}>{booking.discountName || "Discount"}</Text>
                  <Text style={{ width: "30%", fontSize: 6, padding: 2, color: "red" }}>- {fmtRp(booking.discountAmount!)}</Text>
                </View>
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                  <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>Harga Setelah Discount</Text>
                  <Text style={{ width: "30%", fontSize: 6, fontWeight: "bold", padding: 2 }}>{fmtRp(Math.max(0, (varSnap?.price ?? 0) - (booking.discountAmount ?? 0)))}</Text>
                </View>
              </>
            )}
            {/* Pembayaran yang sudah masuk — satu baris per TOP berstatus "paid"
                (booking fee, DP, dan cicilan lain yang sudah dibayar saat ini). */}
            {booking.termOfPayments
              .filter((t) => t.paymentStatus === "paid")
              .map((t) => {
                const d = t.dueDate ?? createdAt;
                const tgl = new Date(d).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" });
                return (
                  <View key={t.id} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                    <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>{t.name} via {booking.paymentMethod?.bankName ?? ""} {tgl}</Text>
                    <Text style={{ width: "30%", fontSize: 6, padding: 2 }}>{fmtRp(t.amount)}</Text>
                  </View>
                );
              })}
            {/* Sisa Bayar = total (setelah diskon) − seluruh TOP yang sudah paid */}
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>Sisa Bayar</Text>
              <Text style={{ width: "30%", fontSize: 6, fontWeight: "bold", padding: 2 }}>{(() => { const totalPrice = (booking.discountAmount ?? 0) > 0 ? Math.max(0, (varSnap?.price ?? 0) - (booking.discountAmount ?? 0)) : (varSnap?.price ?? 0); const paidTotal = booking.termOfPayments.filter((t) => t.paymentStatus === "paid").reduce((sum, t) => sum + t.amount, 0); return fmtRp(Math.max(0, totalPrice - paidTotal)); })()}</Text>
            </View>
          </View>

          {/* Closing — teks ngalir natural nempel ke atas; signature di-jaga utuh sendiri */}
          <View>
            <Text style={{ fontSize: 8, marginBottom: 10 }}>
              Demikian Surat Purchase Order ini dibuat oleh pihak penyewa dan penyelenggara dengan keadaan sehat, tanpa paksaan dari pihak manapun. Serta mempunyai kekuatan mengikat satu dengan lainnya. Apabila dikemudian hari salah satu pihak melanggar sesuai dengan ketentuan diatas, maka perjanjian ini menjadi bukti yang sah dan sempurna di mata hukum.
            </Text>
            <Text style={{ fontSize: 7, fontWeight: "bold", marginTop: 10 }}>
              {booking.signingLocation ?? "_______________"}, {new Date(createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta" })}
            </Text>
            <View wrap={false} style={{ flexDirection: "row", marginTop: 12, marginBottom: 6 }}>
              {/* E-Meterai QR — hanya jika ada */}
              {ematerai && (
                <View style={{ flex: 1, alignItems: "center" }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={ematerai.qrBase64.startsWith("data:") ? ematerai.qrBase64 : `data:image/png;base64,${ematerai.qrBase64}`}
                    style={{ width: 56, height: 56, marginBottom: 4 }}
                  />
                  <Text style={{ fontSize: 6, textAlign: "center", color: "#333" }}>E-Meterai</Text>
                  <Text style={{ fontSize: 5, textAlign: "center", color: "#555" }}>{ematerai.sn}</Text>
                </View>
              )}
              {/* Client */}
              <View style={{ flex: 1, alignItems: "center" }}>
                <View style={{ width: 100, height: 36, marginBottom: 4, justifyContent: "center", alignItems: "center" }}>
                  {sigs?.client?.signature ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={sigs.client.signature} style={{ maxWidth: 100, maxHeight: 36, objectFit: "contain" }} />
                  ) : null}
                </View>
                <Text style={s.signerName}>({booking.snapCustomer?.name ?? ""})</Text>
                <Text style={s.signatureLabel}>Client</Text>
              </View>
              {/* Role signers — dynamic from approval steps */}
              {sigs?.roles?.map((r, i) => (
                <View key={`${i}-${r.title}`} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{ width: 100, height: 36, marginBottom: 4, justifyContent: "center", alignItems: "center" }}>
                    {r.signature ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image src={r.signature} style={{ maxWidth: 100, maxHeight: 36, objectFit: "contain" }} />
                    ) : null}
                  </View>
                  <Text style={s.signerName}>({r.name})</Text>
                  <Text style={s.signatureLabel}>{r.title}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
