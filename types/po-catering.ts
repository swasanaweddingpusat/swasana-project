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
  const rows = [...data.rows];
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
  return {
    version: 2,
    rows: [
      { id: "44a95f01-1cf7-4054-ad30-5a465db4f1d3", type: "subgroup", label: "PEMBAYARAN PAKET TERDIRI DARI :", grandTotal: 45000000 },
      { id: "f2c43fee-63fb-47da-b6bb-6355b3d6c5e4", type: "subgroup", label: "Kriteria Menu Gubuk dari Paket" },
      { id: "a6911540-0b32-45c6-92a3-8ec8bed8d3e1", type: "item", no: 1, description: "Buffet", qty: 600, unit: "Porsi" },
      { id: "b9f78a40-aff8-48e7-ac29-628da768f620", type: "subgroup", label: "Gubukan" },
      { id: "d9f46904-e3bf-4a67-b10e-fc22e353b536", type: "item", no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi" },
      { id: "0868b83b-8993-4f43-9d4a-b47b5e319441", type: "item", no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi" },
      { id: "2fc6a50e-0e53-4dbd-bdc6-45696d370d92", type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi" },
      { id: "34abf0bd-a952-4458-9209-12396b62f541", type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi" },
      { id: "285bd127-79a7-430c-90dc-f30ad8d400f5", type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor" },

      { id: "d5d546ea-bf01-46cb-831a-02eb0dfe8a46", type: "group", label: "Additional Pagi" },
      { id: "017e045e-645c-4b95-80b2-d2c0e9390cc2", type: "subgroup", label: "Buffet" },
      { id: "2d70605e-7862-4c19-af3a-d05bb9099d1b", type: "item", no: 1, description: "Buffet", qty: 600, unit: "Porsi", price: 85000 },
      { id: "bf40b651-2675-49c5-b17d-a3bef5e0a358", type: "subtotal", label: "Total Penambahan Buffet", sumRowIds: ["2d70605e-7862-4c19-af3a-d05bb9099d1b"] },

      { id: "fd9c2b1d-95c2-4966-8187-0b03b3d041e7", type: "group", label: "Additional Gubukan" },
      { id: "568f4585-5bc5-47bf-823f-8e02c43aca93", type: "subgroup", label: "Kriteria Menu Gubuk dari Paket" },
      { id: "42b7f40b-60ce-45f7-8714-8859871e3993", type: "item", no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi", price: 37000 },
      { id: "c6181507-aa4a-4244-b8b6-159642cc5099", type: "item", no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi", price: 30000 },
      { id: "973c30de-bcf2-456c-98f5-4b6594639097", type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 },
      { id: "4ce37dd4-97d7-4564-bf63-2f7f84c5ea84", type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 },
      { id: "da078493-851d-43a1-a3bc-f83dbad0bedc", type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 },
      { id: "ce03f51a-d848-48d1-8522-7ce3b8f532b0", type: "subtotal", label: "Jumlah", sumRowIds: ["42b7f40b-60ce-45f7-8714-8859871e3993", "c6181507-aa4a-4244-b8b6-159642cc5099", "973c30de-bcf2-456c-98f5-4b6594639097", "4ce37dd4-97d7-4564-bf63-2f7f84c5ea84", "da078493-851d-43a1-a3bc-f83dbad0bedc"] },

      { id: "9b57fea8-b051-4532-8eb8-790997785228", type: "subgroup", label: "Kriteria Menu Gubuk yang dipilih" },
      { id: "0cacccf9-2072-4aba-96f2-af54fb585655", type: "item", no: 1, description: "Zuppa Soup", qty: 200, unit: "Porsi", price: 34000 },
      { id: "472585b8-f06f-4b99-bbd9-4fa265fa0663", type: "item", no: 2, description: "Bakwan Malang", qty: 220, unit: "Porsi", price: 30000 },
      { id: "de264db1-2506-4a6d-a8c3-8e7d74e9fed1", type: "item", no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 },
      { id: "053e719d-6298-4462-8909-fd80ddf9f075", type: "item", no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 },
      { id: "39965b20-cc4b-4450-941d-64f6da42ed0b", type: "item", no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 },
      { id: "9fc21461-5a64-444a-9f20-eb1d7ff2e817", type: "item", no: 6, description: "Ice Cream", qty: 200, unit: "Porsi", price: 15000 },
      { id: "afa62b8e-05d3-47f5-9abe-a4e769b1516f", type: "subtotal", label: "Jumlah", sumRowIds: ["0cacccf9-2072-4aba-96f2-af54fb585655", "472585b8-f06f-4b99-bbd9-4fa265fa0663", "de264db1-2506-4a6d-a8c3-8e7d74e9fed1", "053e719d-6298-4462-8909-fd80ddf9f075", "39965b20-cc4b-4450-941d-64f6da42ed0b", "9fc21461-5a64-444a-9f20-eb1d7ff2e817"] },
      { id: "3765e544-e1ac-4b1d-85ac-62103cd71997", type: "formula", label: "Selisih Gubukan", formulaKind: "diff", formulaAIds: ["0cacccf9-2072-4aba-96f2-af54fb585655", "472585b8-f06f-4b99-bbd9-4fa265fa0663", "de264db1-2506-4a6d-a8c3-8e7d74e9fed1", "053e719d-6298-4462-8909-fd80ddf9f075", "39965b20-cc4b-4450-941d-64f6da42ed0b", "9fc21461-5a64-444a-9f20-eb1d7ff2e817"], formulaBIds: ["42b7f40b-60ce-45f7-8714-8859871e3993", "c6181507-aa4a-4244-b8b6-159642cc5099", "973c30de-bcf2-456c-98f5-4b6594639097", "4ce37dd4-97d7-4564-bf63-2f7f84c5ea84", "da078493-851d-43a1-a3bc-f83dbad0bedc"] },
      { id: "c90dbc71-6c60-45ac-9f7a-a6e07f854815", type: "formula", label: "Total Penambahan Buffet + Gubukan", formulaKind: "sum", formulaAIds: ["2d70605e-7862-4c19-af3a-d05bb9099d1b", "0cacccf9-2072-4aba-96f2-af54fb585655", "472585b8-f06f-4b99-bbd9-4fa265fa0663", "de264db1-2506-4a6d-a8c3-8e7d74e9fed1", "053e719d-6298-4462-8909-fd80ddf9f075", "39965b20-cc4b-4450-941d-64f6da42ed0b", "9fc21461-5a64-444a-9f20-eb1d7ff2e817"] },

      { id: "4239cc6a-1f51-46c1-98d6-96239314234f", type: "subgroup", label: "TOTAL PEMBAYARAN MAKANAN", grandTotal: 96000000 },
      { id: "d6a54c7c-2cdf-4bdd-bad6-e284ca9e8fb4", type: "subgroup", label: "PEMBAYARAN SWASANA BRIN THAMRIN KE CATERING" },
      { id: "80bd4ba0-ee22-44d7-a853-b61a4c0992fb", type: "item", no: 1, description: "Charge Gubukan 15%", negative: true },
      { id: "6d035ba2-35b6-4452-9546-5a284ddbee2f", type: "item", no: 2, description: "Charge Buffet", qty: 600, unit: "Porsi", price: 30000, negative: true },
      { id: "f1fd0ac9-5387-472f-92b0-649f9ee8dd91", type: "item", no: 3, description: "Sewa Meja", unit: "Pcs", negative: true },
      { id: "c627c89f-0173-4d67-a936-acb93ecc3c7f", type: "item", no: 4, description: "Galon", qty: 7, unit: "Pcs", price: 17000, negative: true },
    ],
  };
}
