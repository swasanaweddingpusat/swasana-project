// ─── PO Catering Table Types ─────────────────────────────────────────────────
// Flat table structure — each section has rows that can be items, headers,
// subtotals, or formula rows. Stored as JSON in DB.

export type RowType = "header" | "item" | "subtotal" | "formula";

export type FormulaOp =
  | { kind: "sum" }                                    // sum all items in this section
  | { kind: "diff"; a: string; b: string }             // sectionId_a total - sectionId_b total
  | { kind: "sum_sections"; ids: string[] }             // sum totals of multiple sections
  | { kind: "percent"; value: number; of: string }      // percentage of a section total
  | { kind: "negate" };                                  // negate: -(qty × price)

export interface PORow {
  id: string;
  type: RowType;
  // header
  label?: string;
  colSpan?: number;
  // item
  no?: number;
  description?: string;
  qty?: number;
  unit?: string;
  price?: number;
  negative?: boolean;       // charges render as negative
  // subtotal / formula
  formula?: FormulaOp;
  // computed (not stored, calculated at runtime)
  _total?: number;
  _grandTotal?: number;
}

export interface POSection {
  id: string;
  name: string;
  grandTotalLabel?: string;
  grandTotalFormula?: FormulaOp;
  manualGrandTotal?: number;       // user can override with manual value
  rows: PORow[];
}

export interface POCateringData {
  version: 1;
  sections: POSection[];
}

// ─── Calculation Engine ──────────────────────────────────────────────────────

/** Calculate total for a single item row */
function calcItemTotal(row: PORow): number {
  const t = (row.qty ?? 0) * (row.price ?? 0);
  return row.negative ? -t : t;
}

/** Sum all item rows in a section */
function sumSection(section: POSection): number {
  return section.rows
    .filter((r) => r.type === "item")
    .reduce((sum, r) => sum + calcItemTotal(r), 0);
}

/** Get section by id */
function getSection(sections: POSection[], id: string): POSection | undefined {
  return sections.find((s) => s.id === id);
}

/** Evaluate a formula */
function evalFormula(formula: FormulaOp, currentSection: POSection, allSections: POSection[]): number {
  switch (formula.kind) {
    case "sum":
      return sumSection(currentSection);
    case "diff": {
      const a = getSection(allSections, formula.a);
      const b = getSection(allSections, formula.b);
      return (a ? sumSection(a) : 0) - (b ? sumSection(b) : 0);
    }
    case "sum_sections":
      return formula.ids.reduce((sum, id) => {
        const s = getSection(allSections, id);
        return sum + (s ? sumSection(s) : 0);
      }, 0);
    case "percent": {
      const s = getSection(allSections, formula.of);
      return Math.round((s ? sumSection(s) : 0) * (formula.value / 100));
    }
    case "negate":
      return -sumSection(currentSection);
    default:
      return 0;
  }
}

/** Calculate all rows in all sections — mutates _total and _grandTotal */
export function calculateAll(data: POCateringData): POCateringData {
  const sections = data.sections.map((section) => {
    const rows = section.rows.map((row): PORow => {
      if (row.type === "item") {
        return { ...row, _total: calcItemTotal(row) };
      }
      if ((row.type === "subtotal" || row.type === "formula") && row.formula) {
        return { ...row, _total: evalFormula(row.formula, section, data.sections) };
      }
      return row;
    });

    // Calculate section grand total — manual overrides formula
    let _grandTotal: number | undefined;
    if (section.manualGrandTotal != null && section.manualGrandTotal !== 0) {
      _grandTotal = section.manualGrandTotal;
    } else if (section.grandTotalFormula) {
      _grandTotal = evalFormula(section.grandTotalFormula, { ...section, rows }, data.sections);
    }

    return { ...section, rows, _grandTotal: _grandTotal as number | undefined };
  });

  return { ...data, sections };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createId(): string {
  return crypto.randomUUID();
}

export function createItemRow(overrides?: Partial<PORow>): PORow {
  return { id: createId(), type: "item", description: "", qty: 0, unit: "Porsi", price: 0, ...overrides };
}

export function createHeaderRow(label: string): PORow {
  return { id: createId(), type: "header", label, colSpan: 6 };
}

export function createSubtotalRow(label = "Jumlah"): PORow {
  return { id: createId(), type: "subtotal", label, formula: { kind: "sum" } };
}

export function createSection(name: string, rows: PORow[] = []): POSection {
  return { id: createId(), name, rows };
}

/** Create a default PO Catering template matching the screenshot structure */
export function createDefaultPOCatering(): POCateringData {
  const paketId = createId();
  const buffetAddId = createId();
  const gubukPaketId = createId();
  const gubukPilihanId = createId();
  const chargesId = createId();

  return {
    version: 1,
    sections: [
      {
        id: paketId,
        name: "PEMBAYARAN PAKET TERDIRI DARI :",
        grandTotalLabel: "Grand Total",
        manualGrandTotal: 45000000,
        rows: [
          createHeaderRow("Kriteria Menu Gubuk dari Paket"),
          createItemRow({ no: 1, description: "Buffet", qty: 600, unit: "Porsi" }),
          createHeaderRow("Gubukan"),
          createItemRow({ no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi" }),
          createItemRow({ no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi" }),
          createItemRow({ no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi" }),
          createItemRow({ no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi" }),
          createItemRow({ no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor" }),
          createItemRow({ no: 6, description: "Ice Cream", qty: 200, unit: "Porsi" }),
        ],
      },
      {
        id: buffetAddId,
        name: "Additional Pagi",
        rows: [
          createItemRow({ no: 1, description: "Buffet", qty: 600, unit: "Porsi", price: 85000 }),
          { id: createId(), type: "subtotal", label: "Total Penambahan Buffet", formula: { kind: "sum" } },
        ],
      },
      {
        id: gubukPaketId,
        name: "Additional Gubukan",
        rows: [
          createHeaderRow("Kriteria Menu Gubuk dari Paket"),
          createItemRow({ no: 1, description: "Korean BBQ", qty: 200, unit: "Porsi", price: 37000 }),
          createItemRow({ no: 2, description: "Bakwan Malang", qty: 200, unit: "Porsi", price: 30000 }),
          createItemRow({ no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 }),
          createItemRow({ no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 }),
          createItemRow({ no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 }),
          createItemRow({ no: 6, description: "Ice Cream", qty: 200, unit: "Porsi", price: 15000 }),
          createSubtotalRow("Jumlah"),
        ],
      },
      {
        id: gubukPilihanId,
        name: "Kriteria Menu Gubuk yang dipilih",
        rows: [
          createItemRow({ no: 1, description: "Zuppa Soup", qty: 200, unit: "Porsi", price: 34000 }),
          createItemRow({ no: 2, description: "Bakwan Malang", qty: 220, unit: "Porsi", price: 30000 }),
          createItemRow({ no: 3, description: "Aneka Pasta", qty: 200, unit: "Porsi", price: 32000 }),
          createItemRow({ no: 4, description: "Sate Ayam", qty: 200, unit: "Porsi", price: 32000 }),
          createItemRow({ no: 5, description: "Kambing Guling", qty: 2, unit: "Ekor", price: 1950000 }),
          createItemRow({ no: 6, description: "Ice Cream", qty: 200, unit: "Porsi", price: 15000 }),
          createSubtotalRow("Jumlah"),
          { id: createId(), type: "formula", label: "Selisih Gubukan", formula: { kind: "diff", a: gubukPilihanId, b: gubukPaketId } },
          { id: createId(), type: "formula", label: "Total Penambahan Buffet + Gubukan", formula: { kind: "sum_sections", ids: [buffetAddId, gubukPilihanId] } },
        ],
      },
      {
        id: chargesId,
        name: "PEMBAYARAN SWASANA BRIN THAMRIN KE CATERING",
        rows: [
          createItemRow({ no: 1, description: "Charge Gubukan 15%", negative: true }),
          createItemRow({ no: 2, description: "Charge Buffet", qty: 600, unit: "Porsi", price: 30000, negative: true }),
          createItemRow({ no: 3, description: "Sewa Meja", unit: "Pcs", negative: true }),
          createItemRow({ no: 4, description: "Galon", qty: 7, unit: "Pcs", price: 17000, negative: true }),
        ],
      },
    ],
  };
}
