import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { POCateringV2, PORow } from "@/types/po-catering";
import { calculateV2 } from "@/types/po-catering";

export interface CateringPOProps {
  booking: {
    poNumber: string | null;
    customerName: string;
    venueName: string;
    brandName: string;
    bookingDate: string;
    weddingSession: string | null;
    packageName: string;
    pax: number;
  };
  vendorName: string;
  poData: POCateringV2;
  logoBase64?: string | null;
  signatures?: Record<string, Record<string, Record<string, string>>> | null;
}

const fmt = (n: number) => `Rp ${Math.abs(n).toLocaleString("id-ID")}`;

const s = StyleSheet.create({
  page: { padding: 32, paddingTop: 110, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  fixedHeader: { position: "absolute", top: 20, left: 32, right: 32, alignItems: "center", backgroundColor: "white", paddingBottom: 10 },
  logo: { width: 180, height: 60, objectFit: "contain" },
  fixedFooter: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", backgroundColor: "white", paddingTop: 10 },
  titleBlock: { alignItems: "center", marginBottom: 16 },
  title: { fontWeight: "bold", fontSize: 13, textTransform: "uppercase" },
  infoBlock: { flexDirection: "row", marginBottom: 16 },
  infoLeft: { flex: 1 },
  infoRight: { flex: 1 },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { width: 100, fontWeight: "bold", fontSize: 9 },
  infoSep: { width: 10, fontSize: 9 },
  infoVal: { flex: 1, fontSize: 9, fontWeight: "bold" },
  // Table
  tableWrapper: { borderWidth: 1, borderColor: "#333", marginBottom: 12 },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 5, backgroundColor: "#f0f0f0" },
  thNo: { width: 30, textAlign: "center", fontWeight: "bold", fontSize: 8 },
  thDesc: { flex: 1, paddingLeft: 6, fontWeight: "bold", fontSize: 8 },
  thQty: { width: 50, textAlign: "center", fontWeight: "bold", fontSize: 8 },
  thUnit: { width: 50, textAlign: "center", fontWeight: "bold", fontSize: 8 },
  thPrice: { width: 85, textAlign: "right", paddingRight: 6, fontWeight: "bold", fontSize: 8 },
  thTotal: { width: 90, textAlign: "right", paddingRight: 6, fontWeight: "bold", fontSize: 8 },
  // Group row
  groupRow: { flexDirection: "row", paddingVertical: 4, paddingLeft: 6, backgroundColor: "#e5e5e5", borderBottomWidth: 0.5, borderBottomColor: "#999" },
  groupLabel: { flex: 1, fontWeight: "bold", fontSize: 9 },
  groupTotal: { width: 90, textAlign: "right", paddingRight: 6, fontWeight: "bold", fontSize: 9 },
  // Subgroup
  subgroupRow0: { flexDirection: "row", paddingVertical: 3, paddingLeft: 6, backgroundColor: "#f3f4f6", borderBottomWidth: 0.5, borderBottomColor: "#ccc" },
  subgroupRow1: { flexDirection: "row", paddingVertical: 3, paddingLeft: 18, backgroundColor: "#f9fafb", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  subgroupRow2: { flexDirection: "row", paddingVertical: 3, paddingLeft: 30, backgroundColor: "#ffffff", borderLeftWidth: 2, borderLeftColor: "#d1d5db", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  // Item row
  tRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  tdNo: { width: 30, textAlign: "center", fontSize: 8 },
  tdDesc: { flex: 1, paddingLeft: 6, fontSize: 8 },
  tdQty: { width: 50, textAlign: "center", fontSize: 8 },
  tdUnit: { width: 50, textAlign: "center", fontSize: 8 },
  tdPrice: { width: 85, textAlign: "right", paddingRight: 6, fontSize: 8 },
  tdTotal: { width: 90, textAlign: "right", paddingRight: 6, fontSize: 8 },
  // Subtotal
  subtotalRow: { flexDirection: "row", paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: "#999", backgroundColor: "#ebebeb" },
  subtotalLabel: { flex: 1, textAlign: "right", paddingRight: 10, fontWeight: "bold", fontSize: 9 },
  subtotalVal: { width: 90, textAlign: "right", paddingRight: 6, fontWeight: "bold", fontSize: 9 },
  // Formula
  formulaRow: { flexDirection: "row", paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: "#999", backgroundColor: "#d9d9d9" },
  // Signature
  sigBlock: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  sigCol: { width: "30%", alignItems: "center" },
  sigLine: { width: 100, height: 50, marginBottom: 4 },
  sigName: { fontWeight: "bold", fontSize: 8, marginBottom: 2 },
  sigTitle: { fontSize: 7, color: "#666" },
});

function renderRow(row: PORow) {
  if (row.type === "group") {
    if (!row.label?.trim()) return null;
    const total = row._total ?? row.grandTotal ?? 0;
    const hasDetail = !!(row.qty || row.unit);
    return (
      <View key={row.id} style={s.groupRow}>
        {hasDetail ? (
          <>
            <Text style={[s.groupLabel, { flex: 1 }]}>{row.label ?? ""}</Text>
            <Text style={{ width: 50, textAlign: "center", fontSize: 8 }}>{row.qty ?? ""}</Text>
            <Text style={{ width: 50, textAlign: "center", fontSize: 8 }}>{row.unit ?? ""}</Text>
            <Text style={{ width: 85 }} />
          </>
        ) : (
          <Text style={[s.groupLabel, { flex: 1 }]}>{row.label ?? ""}</Text>
        )}
        {total > 0 ? <Text style={s.groupTotal}>{fmt(total)}</Text> : !hasDetail ? null : <Text style={{ width: 90 }} />}
      </View>
    );
  }
  if (row.type === "subgroup") {
    if (!row.label?.trim()) return null;
    const total = row._total ?? row.grandTotal ?? 0;
    const depth = row.depth ?? 0;
    const rowStyle = depth === 0 ? s.subgroupRow0 : depth === 1 ? s.subgroupRow1 : s.subgroupRow2;
    const hasDetail = !!(row.qty || row.unit);
    return (
      <View key={row.id} style={rowStyle}>
        {hasDetail ? (
          <>
            <Text style={[s.groupLabel, { flex: 1 }]}>{row.label ?? ""}</Text>
            <Text style={{ width: 50, textAlign: "center", fontSize: 8 }}>{row.qty ?? ""}</Text>
            <Text style={{ width: 50, textAlign: "center", fontSize: 8 }}>{row.unit ?? ""}</Text>
            <Text style={{ width: 85 }} />
          </>
        ) : (
          <Text style={[s.groupLabel, { flex: 1 }]}>{row.label ?? ""}</Text>
        )}
        {total > 0 ? <Text style={s.groupTotal}>{fmt(total)}</Text> : !hasDetail ? null : <Text style={{ width: 90 }} />}
      </View>
    );
  }
  if (row.type === "item") {
    const total = row._total ?? (row.qty ?? 0) * (row.price ?? 0);
    const isNeg = row.negative || total < 0;
    return (
      <View key={row.id} style={s.tRow}>
        <Text style={s.tdNo}>{row.no ?? ""}</Text>
        <Text style={[s.tdDesc, isNeg ? { color: "#dc2626" } : {}]}>{row.description ?? ""}</Text>
        <Text style={s.tdQty}>{row.qty ?? ""}</Text>
        <Text style={s.tdUnit}>{row.unit ?? ""}</Text>
        <Text style={s.tdPrice}>{row.price ? fmt(row.price) : ""}</Text>
        <Text style={[s.tdTotal, isNeg ? { color: "#dc2626" } : {}]}>{total !== 0 ? (isNeg ? `-${fmt(total)}` : fmt(total)) : ""}</Text>
      </View>
    );
  }
  if (row.type === "subtotal" || row.type === "formula") {
    const total = row._total ?? 0;
    const isNeg = total < 0 || row.negative;
    const rowStyle = row.type === "subtotal" ? s.subtotalRow : s.formulaRow;
    return (
      <View key={row.id} style={rowStyle}>
        <Text style={s.subtotalLabel}>{row.label ?? (row.type === "subtotal" ? "Subtotal" : "Total")}</Text>
        <Text style={[s.subtotalVal, isNeg ? { color: "#dc2626" } : {}]}>{total !== 0 ? (isNeg ? `-${fmt(total)}` : fmt(total)) : "-"}</Text>
      </View>
    );
  }
  return null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoSep}>:</Text>
      <Text style={s.infoVal}>{value}</Text>
    </View>
  );
}

export function CateringPOPdf({ booking, vendorName, poData, logoBase64, signatures }: CateringPOProps) {
  const calculated = calculateV2(poData);
  const sessionLabel = booking.weddingSession === "morning" ? "Pagi" : booking.weddingSession === "evening" ? "Malam" : booking.weddingSession === "fullday" ? "Fullday" : "-";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Fixed Header */}
        {logoBase64 && (
          <View style={s.fixedHeader} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoBase64} style={s.logo} />
          </View>
        )}

        {/* Fixed Footer */}
        <View style={s.fixedFooter} fixed>
          <Text style={{ fontSize: 8, color: "#000" }}>Kediaman Corp - Head Office</Text>
          <Text style={{ fontSize: 8, color: "#666" }}>Jl. HR. Rasuna Said Kav. B12, Jakarta Selatan 12920</Text>
        </View>

        {/* Title */}
        <View style={s.titleBlock}>
          <Text style={s.title}>PURCHASE ORDER CATERING</Text>
          <Text style={{ fontSize: 9, marginTop: 2 }}>{vendorName}</Text>
        </View>

        {/* Info */}
        <View style={s.infoBlock}>
          <View style={s.infoLeft}>
            <InfoRow label="Customer" value={booking.customerName} />
            <InfoRow label="Venue" value={booking.venueName} />
            <InfoRow label="Package" value={`${booking.packageName} (${booking.pax} PAX)`} />
          </View>
          <View style={s.infoRight}>
            <InfoRow label="No. PO" value={booking.poNumber ?? "-"} />
            <InfoRow label="Tanggal" value={booking.bookingDate} />
            <InfoRow label="Session" value={sessionLabel} />
          </View>
        </View>

        {/* Table */}
        <View style={s.tableWrapper}>
          <View style={s.tHead}>
            <Text style={s.thNo}>NO</Text>
            <Text style={s.thDesc}>DESCRIPTION</Text>
            <Text style={s.thQty}>QTY</Text>
            <Text style={s.thUnit}>UNIT</Text>
            <Text style={s.thPrice}>PRICE</Text>
            <Text style={s.thTotal}>TOTAL</Text>
          </View>
          {calculated.rows.map((row) => renderRow(row))}
        </View>

        {/* Signature */}
        <View style={s.sigBlock}>
          <View style={s.sigCol}>
            {signatures?.catering?.finance?.signature ? (
              /* eslint-disable-next-line jsx-a11y/alt-text */
              <Image src={signatures.catering.finance.signature} style={s.sigLine} />
            ) : (
              <View style={s.sigLine} />
            )}
            <Text style={s.sigName}>{signatures?.catering?.finance?.name ?? ""}</Text>
            <Text style={s.sigTitle}>Finance</Text>
          </View>
          <View style={s.sigCol}>
            {signatures?.catering?.dirops?.signature ? (
              /* eslint-disable-next-line jsx-a11y/alt-text */
              <Image src={signatures.catering.dirops.signature} style={s.sigLine} />
            ) : (
              <View style={s.sigLine} />
            )}
            <Text style={s.sigName}>{signatures?.catering?.dirops?.name ?? ""}</Text>
            <Text style={s.sigTitle}>Direktur Ops</Text>
          </View>
          <View style={s.sigCol}>
            {signatures?.catering?.oprations?.signature ? (
              /* eslint-disable-next-line jsx-a11y/alt-text */
              <Image src={signatures.catering.oprations.signature} style={s.sigLine} />
            ) : (
              <View style={s.sigLine} />
            )}
            <Text style={s.sigName}>{signatures?.catering?.oprations?.name ?? ""}</Text>
            <Text style={s.sigTitle}>Operations</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
