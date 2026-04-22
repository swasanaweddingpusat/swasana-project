// PaketNode — recursive tree structure for PO Catering
// Stored as JSONB in snap_vendor_items.paketData

export type ChargeType = "paketan" | "per_qty" | "persentase";
export type PersentaseDari = "gubukan" | "buffet" | "makanan";

export type GroupOperationType =
  | "bawaan"
  | "penambahan"
  | "pengurangan"
  | "charge"
  | "discount"
  | "pembayaran"
  | "group";

export type GroupMode = "per_qty" | "paketan" | "persentase" | "flat";

export const OPERATION_TYPE_COLORS: Record<GroupOperationType, string> = {
  bawaan: "#000000",
  penambahan: "#000000",
  pengurangan: "#c0392b",
  charge: "#666666",
  discount: "#15803d",
  pembayaran: "#2563eb",
  group: "#000000",
};

export const EDITOR_OPERATION_STYLES = {
  text: { primary: "#000000", secondary: "#666666" },
  background: { primary: "#ffffff", secondary: "#f5f5f5", hover: "#e5e5e5" },
  border: { default: "#8a8a8a", focus: "#000000" },
  delete: "#b91c1c",
} as const;

export const SUMMARY_FINANCIAL_COLORS = {
  negative: "#dc2626",
  positive: "#15803d",
  neutral: "#000000",
} as const;

export interface PaketNode {
  id: string;
  type: "group" | "item";
  title: string;
  group_mode?: GroupMode;
  group_operation_type?: GroupOperationType;
  qty?: number;
  unit?: string;
  price?: number;
  is_menu_pilihan?: boolean;
  source_group_id?: string;
  alternatives?: { id: string; title: string; qty?: number; unit?: string; price?: number }[];
  charge_type?: ChargeType;
  persentase_value?: number;
  persentase_dari?: PersentaseDari | string;
  price_source_ids?: string[];
  amount?: number;
  sort_order?: number;
  children_items?: PaketNode[];
}

export interface CateringSection {
  id: string;
  name: string;
  sort_order: number;
  nodes: PaketNode[];
}

export interface CateringPaketData {
  version: 2 | 3;
  sections: CateringSection[];
}

export interface SummaryTotals {
  baseTotal: number;
  penambahanTotal: number;
  penguranganTotal: number;
  chargeTotal: number;
  discountTotal: number;
  pembayaranTotal: number;
  selisihTotal: number;
  totalMakanan: number;
  totalPayment: number;
  pelunasan: number;
  displayGroups: Array<{
    name: string;
    total: number;
    type: GroupOperationType;
    sectionName: string;
    depth: number;
    isSelisih?: boolean;
  }>;
}

// ─── Default Sections Factory ─────────────────────────────────────────────────

export function createDefaultSections(): CateringSection[] {
  return [
    { id: crypto.randomUUID(), name: "Detail Paket", sort_order: 0, nodes: [] },
    { id: crypto.randomUUID(), name: "Penambahan", sort_order: 1, nodes: [] },
    {
      id: crypto.randomUUID(), name: "Charges", sort_order: 2,
      nodes: [
        { id: crypto.randomUUID(), type: "group", title: "Charge Gubukan", group_mode: "persentase", group_operation_type: "charge", sort_order: 0, persentase_value: 0, price: 0, price_source_ids: [], children_items: [] },
        { id: crypto.randomUUID(), type: "group", title: "Charge Buffet", group_mode: "per_qty", group_operation_type: "charge", sort_order: 1, qty: 0, unit: "Porsi", price: 0, children_items: [] },
        { id: crypto.randomUUID(), type: "group", title: "Sewa Meja", group_mode: "paketan", group_operation_type: "charge", sort_order: 2, price: 0, children_items: [] },
        { id: crypto.randomUUID(), type: "group", title: "Galon", group_mode: "per_qty", group_operation_type: "charge", sort_order: 3, qty: 0, unit: "Pcs", price: 0, children_items: [] },
        { id: crypto.randomUUID(), type: "group", title: "Charge Kebersihan", group_mode: "paketan", group_operation_type: "charge", sort_order: 4, price: 0, children_items: [] },
        { id: crypto.randomUUID(), type: "group", title: "Charge Peralatan", group_mode: "flat", group_operation_type: "charge", sort_order: 5, price: 0, children_items: [] },
      ],
    },
    { id: crypto.randomUUID(), name: "Pembayaran Vendor", sort_order: 3, nodes: [] },
  ];
}

// ─── Calculation Functions ────────────────────────────────────────────────────

export function calcGroupTotal(node: PaketNode, allSections?: CateringSection[]): number {
  if (node.type === "item") return (node.qty ?? 0) * (node.price ?? 0);

  if (node.group_operation_type === "group") {
    const children = node.children_items ?? [];
    const menuPilihanGroups = children.filter((c) => c.type === "group" && c.is_menu_pilihan && c.source_group_id);
    const sourceGroupIds = new Set(menuPilihanGroups.map((mp) => mp.source_group_id));
    const menuPilihanIds = new Set(menuPilihanGroups.map((mp) => mp.id));

    let totalSelisih = 0;
    menuPilihanGroups.forEach((mp) => {
      const src = children.find((c) => c.id === mp.source_group_id);
      if (src) totalSelisih += calcGroupTotal(mp, allSections) - calcGroupTotal(src, allSections);
    });

    let otherTotal = 0;
    children.forEach((c) => {
      if (!sourceGroupIds.has(c.id) && !menuPilihanIds.has(c.id)) otherTotal += calcGroupTotal(c, allSections);
    });
    return totalSelisih + otherTotal;
  }

  switch (node.group_mode) {
    case "per_qty":
      if (node.group_operation_type === "charge" || node.group_operation_type === "discount") return (node.qty ?? 0) * (node.price ?? 0);
      return (node.children_items ?? []).reduce((s, c) => s + calcGroupTotal(c, allSections), 0);
    case "paketan":
      return (node.qty ?? 1) * (node.price ?? 0);
    case "persentase": {
      let base = 0;
      if (node.price_source_ids?.length && allSections) {
        const findNode = (id: string): PaketNode | null => {
          for (const sec of allSections) {
            const f = findInTree(sec.nodes, id);
            if (f) return f;
          }
          return null;
        };
        for (const sid of node.price_source_ids) {
          const src = findNode(sid);
          if (src) {
            const t = calcGroupTotal(src, allSections);
            base += src.group_operation_type === "pengurangan" ? -t : t;
          }
        }
      } else {
        base = node.price ?? 0;
      }
      return Math.round(base * ((node.persentase_value ?? 0) / 100));
    }
    case "flat":
      return node.price ?? 0;
    default:
      return (node.children_items ?? []).reduce((s, c) => s + calcGroupTotal(c, allSections), 0);
  }
}

function findInTree(nodes: PaketNode[], id: string): PaketNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children_items) { const f = findInTree(n.children_items, id); if (f) return f; }
  }
  return null;
}

export function calcPaketNodeTotal(node: PaketNode): number { return calcGroupTotal(node); }
export function calcPaketDataTotal(nodes: PaketNode[], allSections?: CateringSection[]): number {
  return nodes.reduce((s, n) => s + calcGroupTotal(n, allSections), 0);
}

// ─── Summary Totals ───────────────────────────────────────────────────────────

function isGroupSourceForMenuPilihan(groupId: string, allSections: CateringSection[]): boolean {
  const check = (nodes: PaketNode[]): boolean => {
    for (const n of nodes) {
      if (n.type === "group" && n.is_menu_pilihan && n.source_group_id === groupId) return true;
      if (n.children_items && check(n.children_items)) return true;
    }
    return false;
  };
  return allSections.some((s) => check(s.nodes));
}

export function calculateSummaryTotals(sections: CateringSection[], incomingAllocations: number = 0): SummaryTotals {
  let baseTotal = 0, penambahanTotal = 0, penguranganTotal = 0, chargeTotal = 0, discountTotal = 0, pembayaranTotal = 0;
  const displayGroups: SummaryTotals["displayGroups"] = [];

  function processGroup(group: PaketNode, allSections: CateringSection[], sectionName: string, depth = 0, isChildOfGroupType = false): void {
    if (group.is_menu_pilihan) return;
    const isSrc = isGroupSourceForMenuPilihan(group.id, allSections);
    const total = calcGroupTotal(group, allSections);
    const op = group.group_operation_type ?? "bawaan";

    if (op === "group") {
      const children = group.children_items ?? [];
      const mps = children.filter((c) => c.type === "group" && c.is_menu_pilihan && c.source_group_id);
      const srcIds = new Set(mps.map((m) => m.source_group_id));
      const mpIds = new Set(mps.map((m) => m.id));
      let tSelisih = 0;
      mps.forEach((mp) => { const src = children.find((c) => c.id === mp.source_group_id); if (src) tSelisih += calcGroupTotal(mp, allSections) - calcGroupTotal(src, allSections); });
      let otherT = 0;
      children.forEach((c) => { if (!srcIds.has(c.id) && !mpIds.has(c.id)) otherT += calcGroupTotal(c, allSections); });
      const gt = tSelisih + otherT;
      displayGroups.push({ name: group.title, total: gt, type: op, sectionName, depth });
      if (!isChildOfGroupType && gt > 0) penambahanTotal += gt;
      children.forEach((c) => { if (c.type === "group" && !srcIds.has(c.id) && !mpIds.has(c.id)) processGroup(c, allSections, sectionName, depth + 1, true); });
      if (mps.length > 0 && tSelisih !== 0) displayGroups.push({ name: "Selisih Menu Pilihan", total: tSelisih, type: tSelisih < 0 ? "pengurangan" : "penambahan", sectionName, depth: depth + 1, isSelisih: true });
      return;
    }

    displayGroups.push({ name: group.title, total, type: op, sectionName, depth });
    if (!isChildOfGroupType) {
      if (op === "bawaan" && !isSrc) baseTotal += total;
      else if (op === "penambahan") penambahanTotal += total;
      else if (op === "pengurangan") penguranganTotal += total;
      else if (op === "charge") chargeTotal += total;
      else if (op === "discount") discountTotal += total;
      else if (op === "pembayaran") pembayaranTotal += total;
    }
    (group.children_items ?? []).forEach((c) => { if (c.type === "group") processGroup(c, allSections, sectionName, depth + 1, isChildOfGroupType); });
  }

  sections.forEach((sec) => {
    sec.nodes.forEach((n) => {
      if (n.type === "group") processGroup(n, sections, sec.name);
      else if (n.type === "item") baseTotal += (n.qty ?? 0) * (n.price ?? 0);
    });
  });

  const selisihTotal = calculateMenuPilihanSelisih(sections);
  const totalMakanan = baseTotal + penambahanTotal - penguranganTotal - discountTotal + selisihTotal;
  const totalPayment = totalMakanan - chargeTotal;
  const pelunasan = totalPayment - pembayaranTotal - incomingAllocations;

  return { baseTotal, penambahanTotal, penguranganTotal, chargeTotal, discountTotal, pembayaranTotal, selisihTotal, totalMakanan, totalPayment, pelunasan, displayGroups };
}

function calculateMenuPilihanSelisih(sections: CateringSection[]): number {
  let total = 0;
  const findNode = (id: string): PaketNode | null => { for (const s of sections) { const f = findInTree(s.nodes, id); if (f) return f; } return null; };
  const findAllMP = (nodes: PaketNode[]): PaketNode[] => {
    const r: PaketNode[] = [];
    for (const n of nodes) {
      if (n.type === "group" && n.is_menu_pilihan && n.source_group_id) r.push(n);
      if (n.children_items) r.push(...findAllMP(n.children_items));
    }
    return r;
  };
  sections.forEach((s) => {
    findAllMP(s.nodes).forEach((mp) => {
      const src = findNode(mp.source_group_id!);
      if (!src || (src.group_operation_type && src.group_operation_type !== "bawaan")) return;
      total += calcGroupTotal(mp, sections) - calcGroupTotal(src, sections);
    });
  });
  return total;
}

// ─── Migration ────────────────────────────────────────────────────────────────

type LegacySectionType = "paket" | "penambahan" | "pengurangan" | "charge" | "discount" | "payment";

export function migrateLegacyPaketData(raw: unknown): CateringPaketData | null {
  if (!raw) return null;
  const d = raw as Record<string, unknown>;
  if (d.version === 3 && Array.isArray(d.sections)) return d as unknown as CateringPaketData;
  if (d.version === 2 && Array.isArray(d.sections)) {
    const hasLegacy = (d.sections as Array<Record<string, unknown>>).some((s) => s.type !== undefined);
    if (!hasLegacy) return { version: 3, sections: d.sections as CateringSection[] };
  }
  if (Array.isArray(raw)) {
    const secs = createDefaultSections();
    secs[0].nodes = raw as PaketNode[];
    return { version: 3, sections: secs };
  }
  if (d.sections && Array.isArray(d.sections)) {
    const opMap: Record<LegacySectionType, GroupOperationType> = { paket: "bawaan", penambahan: "penambahan", pengurangan: "pengurangan", charge: "charge", discount: "discount", payment: "pembayaran" };
    const migrated = (d.sections as Array<Record<string, unknown>>).map((s) => {
      const defOp = s.type ? opMap[s.type as LegacySectionType] ?? "bawaan" : "bawaan";
      const defMode: GroupMode = (s.mode as GroupMode) ?? "per_qty";
      const nodes = migrateNodes(s.nodes as PaketNode[], defOp, defMode);
      return { id: s.id as string, name: s.name as string, sort_order: s.sort_order as number, nodes };
    });
    return { version: 3, sections: migrated };
  }
  return null;
}

function migrateNodes(nodes: PaketNode[], defOp: GroupOperationType, defMode: GroupMode): PaketNode[] {
  return nodes.map((n) => {
    if (n.type === "item") return n;
    const m: PaketNode = { ...n, group_operation_type: n.group_operation_type ?? defOp, group_mode: n.group_mode ?? defMode };
    if (n.children_items?.length) m.children_items = migrateNodes(n.children_items, m.group_operation_type!, m.group_mode!);
    return m;
  });
}

// ─── Tree Helpers ─────────────────────────────────────────────────────────────

export function updateNodeInTree(nodes: PaketNode[], id: string, updater: (n: PaketNode) => PaketNode): PaketNode[] {
  return nodes.map((n) => n.id === id ? updater(n) : n.children_items ? { ...n, children_items: updateNodeInTree(n.children_items, id, updater) } : n);
}

export function removeNodeFromTree(nodes: PaketNode[], id: string): PaketNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => n.children_items ? { ...n, children_items: removeNodeFromTree(n.children_items, id) } : n);
}

export function addChildToNode(nodes: PaketNode[], parentId: string, child: PaketNode): PaketNode[] {
  return nodes.map((n) => n.id === parentId ? { ...n, children_items: [...(n.children_items ?? []), child] } : n.children_items ? { ...n, children_items: addChildToNode(n.children_items, parentId, child) } : n);
}

export function flattenItems(nodes: PaketNode[]): PaketNode[] {
  return nodes.flatMap((n) => n.type === "item" ? [n] : n.children_items ? flattenItems(n.children_items) : []);
}
