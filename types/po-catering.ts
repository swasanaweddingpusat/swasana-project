// ─── PO Catering v2 — Flat row structure ─────────────────────────────────────

export type RowType = "group" | "subgroup" | "item" | "subtotal" | "formula" | "blank" | "charge" | "payment" | "settlement";

export interface PORow {
  id: string;
  type: RowType;
  // header
  label?: string;
  grandTotal?: number;
  depth?: number;           // nesting level for subgroup (0 = top, 1 = nested, 2 = deeper)          // manual grand total shown on header row (optional)
  // item
  no?: number;
  description?: string;
  qty?: number;
  unit?: string;
  price?: number;
  negative?: boolean;
  // subtotal: sum selected row IDs
  sumRowIds?: string[];
  sumRowSigns?: Record<string, 1 | -1>;  // per-row sign: 1 = add, -1 = subtract
  // formula: diff or sum or percent
  formulaKind?: "diff" | "sum" | "percent";
  formulaAIds?: string[];       // row IDs for group A (or sum list, or percent base)
  formulaBIds?: string[];       // row IDs for group B (diff only)
  percentValue?: number;        // percentage value (for percent kind)
  // charge-specific
  chargeType?: "qty" | "flat" | "percent" | "sum";  // per_qty = qty×price, flat = manual, percent = % dari base, sum = sum of selected rows
  // settlement-specific
  settlementType?: "refund" | "allocation";
  settlementPaymentMethodId?: string;
  settlementNotes?: string;
  isIncoming?: boolean;                  // true = incoming allocation (read-only, dari booking lain)
  settlementSourceLabel?: string;        // label booking sumber (untuk display incoming)
  targetBookingId?: string;              // target booking untuk allocation type
  settlementAmountRowId?: string;        // ambil nominal dari _total row ini
  // computed at runtime
  _total?: number;
  _depth?: number;
}

export interface POCateringV2 {
  version: 2;
  rows: PORow[];
}

// ─── Calculation ─────────────────────────────────────────────────────────────

function rowTotal(row: PORow): number {
  const t = (row.qty ?? 0) * (row.price ?? 0);
  return row.negative ? -t : t;
}

function sumIds(rows: PORow[], ids: string[]): number {
  return rows
    .filter((r) => ids.includes(r.id))
    .reduce((s, r) => {
      if (r.type === "item" || r.type === "subgroup" || r.type === "group" || r.type === "charge" || r.type === "payment" || r.type === "settlement") return s + (r._total ?? rowTotal(r));
      if (r.type === "formula" || r.type === "subtotal") return s + (r._total ?? 0);
      return s;
    }, 0);
}

export function calculateV2(data: POCateringV2): POCateringV2 {
  // Multi-pass with mutable updates so formulas referencing earlier formulas resolve
  let rows = [...data.rows];
  for (let pass = 0; pass < 3; pass++) {
    // Step A: items/subgroups/groups
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.type === "item" || row.type === "subgroup" || row.type === "group" || row.type === "charge" || row.type === "payment" || row.type === "settlement") {
        const t = row.price ? (row.qty ?? 0) * (row.price ?? 0) : (row.grandTotal ?? 0);
        if (row.type === "charge" || row.type === "payment") {
          const ct = row.chargeType ?? "flat";
          let t = 0;
          if (ct === "qty") t = (row.qty ?? 0) * (row.price ?? 0);
          else if (ct === "flat") t = row.grandTotal ?? row.price ?? 0;
          else if (ct === "percent") {
            const base = sumIds(rows, row.formulaAIds ?? []);
            t = Math.round(base * ((row.percentValue ?? 0) / 100));
          } else if (ct === "sum") {
            // skip — resolved in Step D after subtotals
            continue;
          }
          rows[i] = { ...row, _total: -Math.abs(t) };
        } else if (row.type === "settlement") {
          // settlement: positif = lebih bayar / refund keluar
          rows[i] = { ...row, _total: row.grandTotal ?? 0 };
        } else {
          rows[i] = { ...row, _total: row.negative ? -t : t };
        }
      }
    }
    // Step B: formulas (sequential so earlier formulas are available to later ones)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.type === "formula") {
        if (row.formulaKind === "diff") {
          const a = sumIds(rows, row.formulaAIds ?? []);
          const b = sumIds(rows, row.formulaBIds ?? []);
          rows[i] = { ...row, _total: a - b };
        } else if (row.formulaKind === "sum") {
          const total = sumIds(rows, row.formulaAIds ?? []);
          rows[i] = { ...row, _total: row.negative ? -total : total };
        } else if (row.formulaKind === "percent") {
          const base = sumIds(rows, row.formulaAIds ?? []);
          const total = Math.round(base * ((row.percentValue ?? 0) / 100));
          rows[i] = { ...row, _total: row.negative ? -total : total };
        }
      }
    }
    // Step C: subtotals (sequential, after all formulas resolved)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.type === "subtotal") {
        const signs = row.sumRowSigns ?? {};
        const total = rows
          .filter((r) => (row.sumRowIds ?? []).includes(r.id))
          .reduce((s, r) => {
            const val = r._total ?? 0;
            const sign = signs[r.id] ?? 1;
            return s + val * sign;
          }, 0);
        rows[i] = { ...row, _total: total };
      }
    }
    // Step D: payment/charge with chargeType "sum" + settlement with amountRowId (needs subtotals resolved first)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if ((row.type === "charge" || row.type === "payment") && row.chargeType === "sum") {
        const t = sumIds(rows, row.formulaAIds ?? []);
        // t > 0 = masih kurang bayar (display negatif = payment)
        // t < 0 = lebih bayar (display positif = kelebihan)
        rows[i] = { ...row, _total: t > 0 ? -t : Math.abs(t) };
      }
      if (row.type === "settlement" && row.settlementAmountRowId) {
        const src = rows.find((r) => r.id === row.settlementAmountRowId);
        const t = src?._total != null ? Math.abs(src._total) : 0;
        rows[i] = { ...row, _total: t, grandTotal: t };
      }
    }
  }
  return { ...data, rows };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createId(): string { return crypto.randomUUID(); }

export function createDefaultPOV2(): POCateringV2 {
  const b1 = createId(), b2 = createId(), b3 = createId(), b4 = createId(), b5 = createId(), b6 = createId();
  const g1 = createId(), g2 = createId(), g3 = createId(), g4 = createId(), g5 = createId(), g6 = createId();
  const p1 = createId(), p2 = createId(), p3 = createId(), p4 = createId(), p5 = createId(), p6 = createId();

  return {
    version: 2,
    rows: [
      // Section 1 — Paket
      { id: createId(), type: "subgroup", label: "PEMBAYARAN PAKET TERDIRI DARI :", grandTotal: 45000000 },
      { id: createId(), type: "subgroup", label: "Kriteria Menu Gubuk dari Paket" },
      { id: b1, type: "item", no: 1, description: "Buffet", qty: 600, unit: "Porsi" },
      { id: createId(), type: "subgroup", label: "Gubukan" },
      { id: b2, type: "item", no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi" },
      { id: b3, type: "item", no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi" },
      { id: b4, type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi" },
      { id: b5, type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi" },
      { id: b6, type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor" },

      // Section 2 — Additional Buffet
      { id: createId(), type: "group", label: "Additional Pagi" },
      { id: createId(), type: "subgroup", label: "Buffet" },
      { id: g1, type: "item", no: 1, description: "Buffet", qty: 600, unit: "Porsi", price: 85000 },
      { id: createId(), type: "subtotal", label: "Total Penambahan Buffet", sumRowIds: [g1] },

      // Section 3 — Additional Gubukan (paket)
      { id: createId(), type: "group", label: "Additional Gubukan" },
      { id: createId(), type: "subgroup", label: "Kriteria Menu Gubuk dari Paket" },
      { id: g2, type: "item", no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi", price: 37000 },
      { id: g3, type: "item", no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi", price: 30000 },
      { id: g4, type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 },
      { id: g5, type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 },
      { id: g6, type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 },
      { id: createId(), type: "subtotal", label: "Jumlah", sumRowIds: [g2, g3, g4, g5, g6] },

      // Section 4 — Menu Pilihan
      { id: createId(), type: "subgroup", label: "Kriteria Menu Gubuk yang dipilih" },
      { id: p1, type: "item", no: 1, description: "Zuppa Soup", qty: 200, unit: "Porsi", price: 34000 },
      { id: p2, type: "item", no: 2, description: "Bakwan Malang", qty: 220, unit: "Porsi", price: 30000 },
      { id: p3, type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 },
      { id: p4, type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 },
      { id: p5, type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 },
      { id: p6, type: "item", no: 6, description: "Ice Cream", qty: 200, unit: "Porsi", price: 15000 },
      { id: createId(), type: "subtotal", label: "Jumlah", sumRowIds: [p1, p2, p3, p4, p5, p6] },
      { id: createId(), type: "formula", label: "Selisih Gubukan", formulaKind: "diff", formulaAIds: [p1, p2, p3, p4, p5, p6], formulaBIds: [g2, g3, g4, g5, g6] },
      { id: createId(), type: "formula", label: "Total Penambahan Buffet + Gubukan", formulaKind: "sum", formulaAIds: [g1, p1, p2, p3, p4, p5, p6] },

      // Total Makanan
      { id: createId(), type: "subgroup", label: "TOTAL PEMBAYARAN MAKANAN", grandTotal: 96000000 },

      // Charges
      { id: createId(), type: "subgroup", label: "PEMBAYARAN SWASANA BRIN THAMRIN KE CATERING" },
      { id: createId(), type: "item", no: 1, description: "Charge Gubukan 15%", negative: true },
      { id: createId(), type: "item", no: 2, description: "Charge Buffet", qty: 600, unit: "Porsi", price: 30000, negative: true },
      { id: createId(), type: "item", no: 3, description: "Sewa Meja", unit: "Pcs", negative: true },
      { id: createId(), type: "item", no: 4, description: "Galon", qty: 7, unit: "Pcs", price: 17000, negative: true },
    ],
  };
}
