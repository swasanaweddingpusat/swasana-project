"use client";

import { useCallback, useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2, GripVertical, ChevronRight, Calculator, Merge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import type { POCateringV2, PORow } from "@/types/po-catering";
import { calculateV2, createId } from "@/types/po-catering";

function fmtRp(n: number): string {
  if (n === 0) return "Rp0";
  const prefix = n < 0 ? "-" : "";
  return `${prefix}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(n))}`;
}

interface PaymentMethodOption {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankRecipient: string;
}

interface Props {
  data: POCateringV2;
  onChange: (data: POCateringV2) => void;
  readOnly?: boolean;
  paymentMethods?: PaymentMethodOption[];
  eligibleBookings?: { id: string; label: string }[];
}

export function POCateringEditorV2({ data, onChange, readOnly, paymentMethods = [], eligibleBookings = [] }: Props) {
  const computed = useMemo(() => calculateV2(data), [data]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; rowId: string; flipUp?: boolean } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; });

  // Determine which rows are hidden
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    let collapsedGroup: string | null = null;
    let collapsedHeader: string | null = null;
    let collapsedHeaderDepth: number = -1;

    for (const row of computed.rows) {
      if (row.type === "group" || (row.type === "blank" && (row.depth ?? 0) === 0)) {
        collapsedGroup = collapsed.has(row.id) ? row.id : null;
        collapsedHeader = null;
        collapsedHeaderDepth = -1;
      } else if (row.type === "subgroup" || (row.type === "blank" && (row.depth ?? 0) > 0)) {
        if (collapsedGroup) {
          hidden.add(row.id);
        } else {
          const depth = row.depth ?? 0;
          // If we're inside a collapsed header at same or lower depth, hide this row
          if (collapsedHeader && depth > collapsedHeaderDepth) {
            hidden.add(row.id);
          } else {
            // New subgroup at same/higher level — update collapsed state
            if (collapsed.has(row.id)) {
              collapsedHeader = row.id;
              collapsedHeaderDepth = depth;
            } else {
              // Only clear if this subgroup is at same or higher level
              if (depth <= collapsedHeaderDepth) {
                collapsedHeader = null;
                collapsedHeaderDepth = -1;
              }
            }
          }
        }
      } else {
        if (collapsedGroup || collapsedHeader) hidden.add(row.id);
      }
    }
    return hidden;
  }, [computed.rows, collapsed]);

  const update = useCallback(
    (fn: (rows: PORow[]) => PORow[]) => onChange({ ...data, rows: fn(data.rows) }),
    [data, onChange]
  );

  const updateRow = (id: string, patch: Partial<PORow>) =>
    update((rows) => rows.map((r) => r.id !== id ? r : { ...r, ...patch }));

  const removeRow = (id: string) => update((rows) => rows.filter((r) => r.id !== id));

  const duplicateRow = (id: string) =>
    update((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return rows;
      const copy = { ...rows[idx], id: createId() };
      const next = [...rows];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    update((rows) => {
      const oi = rows.findIndex((r) => r.id === active.id);
      const ni = rows.findIndex((r) => r.id === over.id);
      return arrayMove(rows, oi, ni);
    });
  };

  const addRow = (row: PORow) => update((rows) => [...rows, row]);

  const addRowAfter = (afterId: string, row: PORow) =>
    update((rows) => {
      const idx = rows.findIndex((r) => r.id === afterId);
      if (idx < 0) return [...rows, row];
      const next = [...rows];
      next.splice(idx + 1, 0, row);
      return next;
    });

  // Auto-number items sequentially + track depth from parent subgroup
  const numberedRows = useMemo(() => {
    let counter = 0;
    let currentDepth = 0;
    return computed.rows.map((r) => {
      if (r.type === "group" || (r.type === "blank" && (r.depth ?? 0) === 0)) { counter = 0; currentDepth = 0; return r; }
      if (r.type === "subgroup" || (r.type === "blank" && (r.depth ?? 0) > 0)) { counter = 0; currentDepth = (r.depth ?? 0) + 1; return r; }
      if (r.type === "item") { counter++; return { ...r, no: counter, _depth: currentDepth }; }
      if (r.type === "subtotal" || r.type === "formula") { return { ...r, _depth: currentDepth }; }
      return r;
    });
  }, [computed.rows]);

  return (
    <div className="w-full space-y-2">
      <div className="">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={computed.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-gray-300">
                  {!readOnly && <th className="border border-gray-300 w-5" />}
                  <th className="border border-gray-300 px-2 py-1.5 text-left w-[3%]">NO</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left">DESCRIPTION</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right w-[8%]">JUMLAH</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-center w-[6%]">UNIT</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right w-[14%]">HARGA SATUAN</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right w-[15%]">TOTAL</th>
                  {!readOnly && <th className="border border-gray-300 w-5" />}
                </tr>
              </thead>
              <tbody>
                {numberedRows.map((row) => hiddenIds.has(row.id) ? null : (
                  <RowRenderer
                    key={row.id}
                    row={row}
                    allRows={computed.rows}
                    readOnly={readOnly}
                    paymentMethods={paymentMethods}
                    eligibleBookings={eligibleBookings}
                    isCollapsed={collapsed.has(row.id)}
                    onToggleCollapse={(row.type === "subgroup" || row.type === "group") ? () => toggleCollapse(row.id) : undefined}
                    onUpdate={(patch) => updateRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    onContextMenu={readOnly ? undefined : (e) => {
                      e.preventDefault();
                      const menuHeight = 280; // approx height
                      const flipUp = e.clientY + menuHeight > window.innerHeight;
                      setCtxMenu({ x: e.clientX, y: e.clientY, rowId: row.id, flipUp });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* Add row toolbar */}
      {!readOnly && (        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={() => addRow({ id: createId(), type: "group", label: "Group baru", qty: undefined, unit: undefined, price: undefined })} className="flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900 font-semibold">
            <Plus className="h-3 w-3" /> Group
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "item", description: "", unit: "Porsi" })} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus className="h-3 w-3" /> Item
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "subgroup", label: "Sub-group baru", qty: undefined, unit: undefined, price: undefined })} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
            <Merge className="h-3 w-3" /> Sub-group
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "subtotal", label: "Jumlah", sumRowIds: [] })} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800">
            <Calculator className="h-3 w-3" /> Subtotal
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "formula", label: "Formula", formulaKind: "diff", formulaAIds: [], formulaBIds: [] })} className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800">
            <Calculator className="h-3 w-3" /> Formula
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "payment", description: "", chargeType: "flat" })} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Calculator className="h-3 w-3" /> Payment
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "settlement", description: "", settlementType: "refund", grandTotal: 0 })} className="flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900">
            <Calculator className="h-3 w-3" /> Settlement
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "charge", description: "", unit: "Porsi", chargeType: "qty" })} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <Calculator className="h-3 w-3" /> Charge
          </button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => addRow({ id: createId(), type: "blank", depth: 1 })} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <Merge className="h-3 w-3" /> Blank
          </button>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
          <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-42.5" style={ctxMenu.flipUp ? { bottom: window.innerHeight - ctxMenu.y, left: ctxMenu.x } : { top: ctxMenu.y, left: ctxMenu.x }}>
            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wide">Tambah di bawah</p>
            {([
              { label: "Group", icon: <GripVertical className="h-3 w-3" />, color: "text-gray-700", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "group" as const, label: "Group baru" }) },
              { label: "Sub-group (L1)", icon: <Merge className="h-3 w-3" />, color: "text-purple-600", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "subgroup" as const, label: "Sub-group baru", depth: 0 }) },
              { label: "Sub-group (L2)", icon: <Merge className="h-3 w-3" />, color: "text-purple-500", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "subgroup" as const, label: "Sub-group baru", depth: 1 }) },
              { label: "Sub-group (L3)", icon: <Merge className="h-3 w-3" />, color: "text-purple-400", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "subgroup" as const, label: "Sub-group baru", depth: 2 }) },
              { label: "Item", icon: <Plus className="h-3 w-3" />, color: "text-blue-600", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "item" as const, description: "", unit: "Porsi" }) },
              { label: "Subtotal", icon: <Calculator className="h-3 w-3" />, color: "text-green-600", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "subtotal" as const, label: "Jumlah", sumRowIds: [] }) },
              { label: "Formula", icon: <Calculator className="h-3 w-3" />, color: "text-orange-600", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "formula" as const, label: "Formula", formulaKind: "diff", formulaAIds: [], formulaBIds: [] }) },
              { label: "Charge", icon: <Calculator className="h-3 w-3" />, color: "text-red-500", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "charge" as const, description: "", unit: "Porsi", chargeType: "qty" }) },
              { label: "Payment", icon: <Calculator className="h-3 w-3" />, color: "text-blue-600", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "payment" as const, description: "", chargeType: "flat" }) },
              { label: "Settlement", icon: <Calculator className="h-3 w-3" />, color: "text-gray-700", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "settlement" as const, description: "", settlementType: "refund", grandTotal: 0 }) },
              { label: "Blank", icon: <Merge className="h-3 w-3" />, color: "text-gray-400", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "blank" as const, depth: 0 }) },
              { label: "Blank (L1)", icon: <Merge className="h-3 w-3" />, color: "text-gray-400", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "blank" as const, depth: 0 }) },
              { label: "Blank (L2)", icon: <Merge className="h-3 w-3" />, color: "text-gray-400", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "blank" as const, depth: 1 }) },
              { label: "Blank (L3)", icon: <Merge className="h-3 w-3" />, color: "text-gray-400", fn: () => addRowAfter(ctxMenu.rowId, { id: createId(), type: "blank" as const, depth: 2 }) },
            ] as { label: string; icon: React.ReactNode; color: string; fn: () => void }[]).map(({ label, icon, color, fn }) => (
              <button key={label} type="button" className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${color}`} onClick={() => { fn(); setCtxMenu(null); }}>
                {icon} {label}
              </button>
            ))}
            <div className="border-t border-gray-100 my-1" />
            <button type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-600" onClick={() => { duplicateRow(ctxMenu.rowId); setCtxMenu(null); }}>
              <Plus className="h-3 w-3" /> Duplicate
            </button>
            <button type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600" onClick={() => { removeRow(ctxMenu.rowId); setCtxMenu(null); }}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Row Renderer ────────────────────────────────────────────────────────────

interface RowProps {
  row: PORow;
  allRows: PORow[];
  readOnly?: boolean;
  paymentMethods?: PaymentMethodOption[];
  eligibleBookings?: { id: string; label: string }[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onUpdate: (patch: Partial<PORow>) => void;
  onRemove: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function RowRenderer({ row, allRows, readOnly, paymentMethods = [], eligibleBookings = [], isCollapsed, onToggleCollapse, onUpdate, onRemove, onContextMenu }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: !!readOnly });
  const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const dragHandle = !readOnly && (
    <td className="border border-gray-300 px-0.5 w-5 cursor-grab">
      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100" {...attributes} {...listeners}>
        <GripVertical className="h-3.5 w-3.5 text-gray-400" />
      </div>
    </td>
  );

  const deleteBtn = !readOnly && (
    <td className="border border-gray-300 px-1 w-5">
      <button type="button" onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
        <Trash2 className="h-3 w-3" />
      </button>
    </td>
  );

  // ─── Blank ─────────────────────────────────────────────────────────────────
  if (row.type === "blank") {
    const colCount = 6;
    const indent = (row.depth ?? 0) * 12;
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="group">
        {dragHandle}
        <td colSpan={colCount} className="border border-gray-300 px-2 py-1" style={{ paddingLeft: indent + 8 }}>
          {readOnly ? (
            <span className="text-xs">{row.label ?? ""}</span>
          ) : (
            <input className="w-full bg-transparent outline-none text-xs" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="" />
          )}
        </td>
        {deleteBtn}
      </tr>
    );
  }

  // ─── Group ────────────────────────────────────────────────────────────────
  if (row.type === "group") {
    const hasPrice = !!row.price;
    const calculatedTotal = (row.qty ?? 0) * (row.price ?? 0);
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="bg-[#e5e5e5] group">
        {dragHandle}
        {/* NO + Description merged */}
        <td colSpan={2} className="border border-gray-300 px-2 py-1.5 font-bold text-xs">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onToggleCollapse} className="text-gray-500 hover:text-gray-800 shrink-0">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")} />
            </button>
            {readOnly ? row.label : (
              <input className="flex-1 bg-transparent outline-none font-bold text-xs" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
            )}
          </div>
        </td>
        {/* JUMLAH */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-right text-xs font-semibold">{row.qty ?? ""}</span> : (
            <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} />
          )}
        </td>
        {/* UNIT */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-center text-xs font-semibold">{row.unit ?? ""}</span> : (
            <input className="w-full bg-transparent outline-none text-center text-xs px-1" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} />
          )}
        </td>
        {/* HARGA SATUAN */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-right text-xs font-semibold">{row.price ? fmtRp(row.price) : ""}</span> : (
            <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs px-1" value={row.price ? new Intl.NumberFormat("id-ID").format(row.price) : ""} onChange={(e) => onUpdate({ price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
          )}
        </td>
        {/* TOTAL — calculated if price filled, manual if not */}
        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-xs">
          {hasPrice ? (
            calculatedTotal !== 0 ? fmtRp(calculatedTotal) : ""
          ) : readOnly ? (
            row.grandTotal ? fmtRp(row.grandTotal) : ""
          ) : (
            <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right font-bold text-xs" value={row.grandTotal ? new Intl.NumberFormat("id-ID").format(row.grandTotal) : ""} onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="Total manual" />
          )}
        </td>
        {deleteBtn}
      </tr>
    );
  }

  // ─── Sub-group ────────────────────────────────────────────────────────────

  // ─── Header ──────────────────────────────────────────────────────────────
  if (row.type === "subgroup") {
    const depth = row.depth ?? 0;
    const bgColor = depth === 0 ? "bg-gray-100" : depth === 1 ? "bg-gray-50" : "bg-white border-l-2 border-gray-300";
    const labelIndent = depth * 12;
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className={`${bgColor} group`}>
        {dragHandle}
        {/* NO + Description merged */}
        <td colSpan={2} className="border border-gray-300 px-2 py-1.5 font-bold text-xs">
          <div className="flex items-center gap-1" style={{ paddingLeft: labelIndent }}>
            <button type="button" onClick={onToggleCollapse} className="text-gray-400 hover:text-gray-700 shrink-0">
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")} />
            </button>
            {readOnly ? row.label : (
              <input className="flex-1 bg-transparent outline-none font-bold text-xs" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
            )}
          </div>
        </td>
        {/* JUMLAH */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-right text-xs font-semibold">{row.qty ?? ""}</span> : (
            <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
          )}
        </td>
        {/* UNIT */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-center text-xs font-semibold">{row.unit ?? ""}</span> : (
            <input className="w-full bg-transparent outline-none text-center text-xs px-1" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} placeholder="Unit" />
          )}
        </td>
        {/* HARGA SATUAN — subgroup */}
        <td className="border border-gray-300 px-1 py-0.5">
          {readOnly ? <span className="block text-right text-xs font-semibold">{row.price ? fmtRp(row.price) : ""}</span> : (
            <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs px-1" value={row.price ? new Intl.NumberFormat("id-ID").format(row.price) : ""} onChange={(e) => onUpdate({ price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
          )}
        </td>
        {/* TOTAL — calculated if price filled, manual if not */}
        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-xs">          {row.price ? (
            row._total != null && row._total !== 0 ? fmtRp(row._total) : ""
          ) : readOnly ? (
            row.grandTotal ? fmtRp(row.grandTotal) : ""
          ) : (
            <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right font-bold text-xs" value={row.grandTotal ? new Intl.NumberFormat("id-ID").format(row.grandTotal) : ""} onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="Total manual" />
          )}
        </td>
        {deleteBtn}
      </tr>
    );
  }
  // ─── Charge ──────────────────────────────────────────────────────────────
  if (row.type === "charge") {
    const depth = row._depth ?? 0;
    const indent = depth * 12;
    const total = row._total ?? 0;
    const ct = row.chargeType ?? "qty";
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="group">
        {dragHandle}
        {/* NO + DESC merged */}
        <td colSpan={2} className="border border-gray-300 px-2 py-1 text-xs" style={{ paddingLeft: indent + 8 }}>
          <div className="flex items-center gap-1.5">
            {!readOnly && (
              <select className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 shrink-0" value={ct} onChange={(e) => onUpdate({ chargeType: e.target.value as "qty" | "flat" | "percent" })}>
                <option value="qty">Qty</option>
                <option value="flat">Flat</option>
                <option value="percent">Persen</option>
              </select>
            )}
            {readOnly ? <span>{row.description}</span> : (
              <input className="flex-1 bg-transparent outline-none text-xs" value={row.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Nama charge..." />
            )}
          </div>
        </td>
        {/* JUMLAH */}
        <td className="border border-gray-300 px-1 py-0.5">
          {(ct === "qty" || ct === "flat") && (
            readOnly ? <span className="block text-right text-xs">{row.qty ?? ""}</span> : (
              <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} />
            )
          )}
          {ct === "percent" && !readOnly && (
            <div className="flex items-center justify-end gap-0.5">
              <input type="number" className="w-10 bg-transparent outline-none text-right text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.percentValue ?? ""} onChange={(e) => onUpdate({ percentValue: Number(e.target.value) || 0 })} placeholder="0" />
              <span className="text-[10px] text-gray-400">%</span>
            </div>
          )}
        </td>
        {/* UNIT */}
        <td className="border border-gray-300 px-1 py-0.5">
          {(ct === "qty" || ct === "flat") && (
            readOnly ? <span className="block text-center text-xs">{row.unit ?? ""}</span> : (
              <input className="w-full bg-transparent outline-none text-center text-xs px-1" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} />
            )
          )}
          {ct === "percent" && !readOnly && (
            <RowPicker label="dari:" selectedIds={row.formulaAIds ?? []} rows={allRows} onChange={(ids) => onUpdate({ formulaAIds: ids })} />
          )}
        </td>
        {/* HARGA SATUAN */}
        <td className="border border-gray-300 px-1 py-0.5">
          {(ct === "qty" || ct === "flat") && (
            readOnly ? <span className="block text-right text-xs">{row.price ? fmtRp(row.price) : ""}</span> : (
              <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs px-1" value={row.price ? new Intl.NumberFormat("id-ID").format(row.price) : ""} onChange={(e) => onUpdate({ price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
            )
          )}
        </td>
        {/* TOTAL — per_qty auto-calc, flat manual, percent auto-calc */}
        <td className="border border-gray-300 px-2 py-1 text-right text-xs text-red-600 font-semibold">
          {ct === "flat" ? (
            readOnly ? (row.grandTotal ? fmtRp(-Math.abs(row.grandTotal)) : "") : (
              <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs text-red-600" value={row.grandTotal ? `-Rp${new Intl.NumberFormat("id-ID").format(row.grandTotal)}` : ""} onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="-Rp0" />
            )
          ) : (
            total !== 0 ? fmtRp(total) : ""
          )}
        </td>
        {deleteBtn}
      </tr>
    );
  }
  // ─── Payment ─────────────────────────────────────────────────────────────
  if (row.type === "payment") {
    const depth = row._depth ?? 0;
    const indent = depth * 12;
    const total = row._total ?? 0;
    const ct = row.chargeType ?? "flat";
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="group">
        {dragHandle}
        <td colSpan={2} className="border border-gray-300 px-2 py-1 text-xs" style={{ paddingLeft: indent + 8 }}>
          <div className="flex items-center gap-1.5">
            {!readOnly && (
              <select className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 shrink-0" value={ct} onChange={(e) => onUpdate({ chargeType: e.target.value as "qty" | "flat" | "percent" | "sum" })}>
                <option value="flat">Flat</option>
                <option value="qty">Qty</option>
                <option value="sum">Sum</option>
              </select>
            )}
            {readOnly ? <span>{row.description}</span> : (
              <input className="flex-1 bg-transparent outline-none text-xs" value={row.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Nama pembayaran..." />
            )}
          </div>
        </td>
        <td className="border border-gray-300 px-1 py-0.5">
          {ct === "qty" && (
            readOnly ? <span className="block text-right text-xs">{row.qty ?? ""}</span> : (
              <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} />
            )
          )}
        </td>
        <td className="border border-gray-300 px-1 py-0.5">
          {ct === "qty" && (
            readOnly ? <span className="block text-center text-xs">{row.unit ?? ""}</span> : (
              <input className="w-full bg-transparent outline-none text-center text-xs px-1" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} />
            )
          )}
          {ct === "sum" && !readOnly && (
            <RowPicker label="dari:" selectedIds={row.formulaAIds ?? []} rows={allRows} onChange={(ids) => onUpdate({ formulaAIds: ids })} />
          )}
        </td>
        <td className="border border-gray-300 px-1 py-0.5">
          {ct === "qty" && (
            readOnly ? <span className="block text-right text-xs">{row.price ? fmtRp(row.price) : ""}</span> : (
              <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs px-1" value={row.price ? new Intl.NumberFormat("id-ID").format(row.price) : ""} onChange={(e) => onUpdate({ price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
            )
          )}
        </td>
        <td className={cn("border border-gray-300 px-2 py-1 text-right text-xs font-semibold", ct === "sum" && total > 0 && "bg-primary/5 text-primary")}>
          {ct === "flat" ? (
            readOnly ? (row.grandTotal ? fmtRp(-Math.abs(row.grandTotal)) : "") : (
              <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs" value={row.grandTotal ? `-Rp${new Intl.NumberFormat("id-ID").format(row.grandTotal)}` : ""} onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="-Rp0" />
            )
          ) : (
            total !== 0 ? fmtRp(total) : ""
          )}
        </td>
        {deleteBtn}
      </tr>
    );
  }

  // ─── Settlement ───────────────────────────────────────────────────────────
  if (row.type === "settlement") {
    const total = row._total ?? 0;
    const sType = row.settlementType ?? "refund";
    const isIncoming = row.isIncoming === true;
    const effectiveReadOnly = readOnly || isIncoming;
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={!isIncoming ? onContextMenu : undefined} className={cn("group", isIncoming ? "bg-accent/40" : "bg-muted/30")}>
        {dragHandle}
        <td colSpan={2} className="border border-gray-300 px-2 py-1 text-xs">
          <div className="flex items-center gap-1.5">
            {!effectiveReadOnly && (
              <select
                className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 shrink-0"
                value={sType}
                onChange={(e) => onUpdate({ settlementType: e.target.value as "refund" | "allocation" })}
              >
                <option value="refund">Refund</option>
                <option value="allocation">Alokasi</option>
              </select>
            )}
            {isIncoming && <span className="text-[10px] text-muted-foreground shrink-0 italic">Masuk ←</span>}
            {effectiveReadOnly ? (
              <span>{row.description || `Settlement ${sType}`}</span>
            ) : (
              <input
                className="flex-1 bg-transparent outline-none text-xs"
                value={row.description ?? ""}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Keterangan..."
              />
            )}
          </div>
        </td>
        {/* Rekening / target booking + sumber nominal */}
        <td colSpan={3} className="border border-gray-300 px-1 py-0.5">
          <div className="flex items-center gap-1">
            {sType === "refund" && !effectiveReadOnly && (
              <BankAccountSelect
                className="flex-1 [&_button]:h-7 [&_button]:text-[10px] [&_button]:py-0 [&_button]:px-2"
                value={row.settlementPaymentMethodId ?? ""}
                onChange={(v) => onUpdate({ settlementPaymentMethodId: v || undefined })}
                placeholder="Pilih rekening..."
                minDropdownWidth={320}
              />
            )}
            {sType === "refund" && effectiveReadOnly && (
              <span className="text-[11px] text-muted-foreground px-1 flex-1">
                {paymentMethods.find((pm) => pm.id === row.settlementPaymentMethodId)?.bankName ?? "-"}
              </span>
            )}
            {sType === "allocation" && !effectiveReadOnly && (
              <SearchableSelect
                className="flex-1 [&_button]:h-7 [&_button]:text-[10px] [&_button]:py-0 [&_button]:px-2"
                options={eligibleBookings.map((b) => ({ id: b.id, name: b.label }))}
                value={row.targetBookingId ?? ""}
                onChange={(v) => onUpdate({ targetBookingId: v || undefined })}
                placeholder="Pilih booking tujuan..."
                minDropdownWidth={320}
              />
            )}
            {sType === "allocation" && effectiveReadOnly && (
              <span className="text-[11px] text-muted-foreground px-1 italic flex-1">
                {isIncoming ? (row.settlementSourceLabel ?? "Booking lain") : (eligibleBookings.find((b) => b.id === row.targetBookingId)?.label ?? row.settlementSourceLabel ?? "-")}
              </span>
            )}
            {!effectiveReadOnly && (
              <SearchableSelect
                className="w-30 shrink-0 [&_button]:h-7 [&_button]:text-[10px] [&_button]:py-0 [&_button]:px-2"
                options={allRows.filter((r) => r._total != null && r._total !== 0 && r.id !== row.id).map((r) => ({
                  id: r.id,
                  name: `${r.label ?? r.description ?? r.type} (${fmtRp(Math.abs(r._total!))})`,
                }))}
                value={row.settlementAmountRowId ?? ""}
                onChange={(v) => onUpdate({ settlementAmountRowId: v || undefined })}
                placeholder="Nominal manual"
                minDropdownWidth={280}
              />
            )}
          </div>
        </td>
        {/* Nominal */}
        <td className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold">
          {effectiveReadOnly || row.settlementAmountRowId ? (
            total !== 0 ? fmtRp(total) : ""
          ) : (
            <input
              type="text"
              inputMode="numeric"
              className="w-full bg-transparent outline-none text-right text-xs font-semibold"
              value={row.grandTotal ? new Intl.NumberFormat("id-ID").format(row.grandTotal) : ""}
              onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })}
              placeholder="0"
            />
          )}
        </td>
        {!isIncoming && deleteBtn}
        {isIncoming && <td className="border border-gray-300 w-5" />}
      </tr>
    );
  }

  // ─── Subtotal ─────────────────────────────────────────────────────────────
  if (row.type === "subtotal") {
    const depth = row._depth ?? 0;
    const indent = depth * 12;
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="bg-gray-50 font-semibold group">
        {dragHandle}
        <td className="border border-gray-300" />
        <td className="border border-gray-300 px-2 py-1 text-xs" style={{ paddingLeft: indent + 8 }}>
          {readOnly ? row.label : (
            <input className="w-full bg-transparent outline-none text-xs font-semibold" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
          )}
        </td>
        <td colSpan={3} className="border border-gray-300 px-1 py-0.5">
          {!readOnly && (
            <RowPicker
              label="Sum dari:"
              selectedIds={row.sumRowIds ?? []}
              signs={row.sumRowSigns}
              rows={allRows}
              onChange={(ids) => onUpdate({ sumRowIds: ids })}
              onSignChange={(signs) => onUpdate({ sumRowSigns: signs })}
            />
          )}
        </td>
        <td className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold">
          {fmtRp(row._total ?? 0)}
        </td>
        {deleteBtn}
      </tr>
    );
  }

  // ─── Formula ──────────────────────────────────────────────────────────────
  if (row.type === "formula") {
    const isNeg = (row._total ?? 0) < 0 || row.negative;
    const depth = row._depth ?? 0;
    const indent = depth * 12;
    return (
      <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="bg-gray-50 font-semibold group">
        {dragHandle}
        <td colSpan={2} className="border border-gray-300 px-2 py-1 text-xs" style={{ paddingLeft: indent + 8 }}>
          {readOnly ? row.label : (
            <input className="w-full bg-transparent outline-none text-xs font-semibold" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
          )}
        </td>
        <td colSpan={3} className="border border-gray-300 px-1 py-0.5">
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5"
                value={row.formulaKind ?? "diff"}
                onChange={(e) => onUpdate({ formulaKind: e.target.value as "diff" | "sum" | "percent" })}
              >
                <option value="diff">A − B</option>
                <option value="sum">SUM</option>
                <option value="percent">PERSEN (%)</option>
              </select>
              {row.formulaKind === "percent" && (
                <>
                  <input
                    type="number"
                    className="w-12 text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={row.percentValue ?? ""}
                    onChange={(e) => onUpdate({ percentValue: Number(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <span className="text-[10px] text-gray-500">% dari</span>
                  <RowPicker label="" selectedIds={row.formulaAIds ?? []} rows={allRows} onChange={(ids) => onUpdate({ formulaAIds: ids })} />
                </>
              )}
              {row.formulaKind !== "percent" && (
                <RowPicker label="A:" selectedIds={row.formulaAIds ?? []} rows={allRows} onChange={(ids) => onUpdate({ formulaAIds: ids })} />
              )}
              {row.formulaKind === "diff" && (
                <RowPicker label="B:" selectedIds={row.formulaBIds ?? []} rows={allRows} onChange={(ids) => onUpdate({ formulaBIds: ids })} />
              )}
              {(row.formulaKind === "sum" || row.formulaKind === "percent") && (
                <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer select-none">
                  <Checkbox checked={row.negative ?? false} onCheckedChange={(v) => onUpdate({ negative: !!v })} />
                  Pengurangan
                </label>
              )}
            </div>
          )}
        </td>
        <td className={cn("border border-gray-300 px-2 py-1 text-right text-xs font-semibold", isNeg && "text-red-600")}>
          {fmtRp(row._total ?? 0)}
        </td>
        {deleteBtn}
      </tr>
    );
  }

  // ─── Item ─────────────────────────────────────────────────────────────────
  return (
    <tr ref={setNodeRef} style={dragStyle} onContextMenu={onContextMenu} className="hover:bg-blue-50/30 group">
      {dragHandle}
      <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500">{row.no ?? ""}</td>
      <td className="border border-gray-300 px-1 py-0.5" style={{ paddingLeft: (row._depth ?? 0) * 12 + 4 }}>
        {readOnly ? <span className="text-xs px-1">{row.description}</span> : (
          <input className="w-full bg-transparent outline-none text-xs px-1 py-0.5" value={row.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Nama item..." />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-right text-xs">{row.qty ?? ""}</span> : (
          <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-center text-xs">{row.unit ?? ""}</span> : (
          <input className="w-full bg-transparent outline-none text-center text-xs px-1" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-right text-xs">{row.price ? fmtRp(row.price) : ""}</span> : (
          <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs px-1" value={row.price ? new Intl.NumberFormat("id-ID").format(row.price) : ""} onChange={(e) => onUpdate({ price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="0" />
        )}
      </td>
      <td className={cn("border border-gray-300 px-2 py-1 text-right text-xs", (row.negative || (row._total ?? 0) < 0) && "text-red-600")}>
        {row.price ? (
          row._total != null && row._total !== 0 ? fmtRp(row._total) : ""
        ) : readOnly ? (
          row.grandTotal ? fmtRp(row.grandTotal) : ""
        ) : (
          <input type="text" inputMode="numeric" className="w-full bg-transparent outline-none text-right text-xs" value={row.grandTotal ? new Intl.NumberFormat("id-ID").format(row.grandTotal) : ""} onChange={(e) => onUpdate({ grandTotal: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="Total manual" />
        )}
      </td>
      {deleteBtn}
    </tr>
  );
}

// ─── Row Picker — multi-select with group + subgroup + item sections ────────────

function RowPicker({ label, selectedIds, signs, rows, onChange, onSignChange }: {
  label: string;
  selectedIds: string[];
  signs?: Record<string, 1 | -1>;
  rows: PORow[];
  onChange: (ids: string[]) => void;
  onSignChange?: (signs: Record<string, 1 | -1>) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selectedIds.length;

  // Build structure: group → subgroups → items
  type SubEntry = { row: PORow; items: PORow[] };
  type GroupEntry = { row: PORow; subs: SubEntry[]; directItems: PORow[] };
  const structure: GroupEntry[] = [];
  const topItems: PORow[] = [];
  let curGroup: GroupEntry | null = null;
  let curSub: SubEntry | null = null;

  for (const row of rows) {
    if (row.type === "group") {
      curGroup = { row, subs: [], directItems: [] };
      curSub = null;
      structure.push(curGroup);
    } else if (row.type === "subgroup") {
      curSub = { row, items: [] };
      if (curGroup) curGroup.subs.push(curSub);
    } else if (row.type === "item" || row.type === "charge" || row.type === "payment") {
      if (curSub) curSub.items.push(row);
      else if (curGroup) curGroup.directItems.push(row);
      else topItems.push(row);
    } else if (row.type === "formula" || row.type === "subtotal") {
      const calcRow = { ...row };
      if (curSub) curSub.items.push(calcRow);
      else if (curGroup) curGroup.directItems.push(calcRow);
      else topItems.push(calcRow);
    }
    // Note: group and subgroup with values are rendered separately in the JSX
  }

  const getLabel = (r: PORow) => r.type === "subtotal" || r.type === "formula"
    ? (r.label || "(formula)")
    : `${r.no ? r.no + ". " : ""}${r.description || "(item)"}`;

  const renderItem = (r: PORow, indent: string) => {
    const isSelected = selectedIds.includes(r.id);
    const sign = signs?.[r.id] ?? 1;
    const label = getLabel(r);
    const isCalc = r.type === "subtotal" || r.type === "formula";
    return (
      <div key={r.id} className={`flex items-center gap-1.5 ${indent} pr-2 py-0.5 hover:bg-gray-50 rounded`}>
        <Checkbox checked={isSelected} onCheckedChange={(v) => toggleIds([r.id], !!v)} />
        <span
          className={`flex-1 min-w-0 text-[11px] cursor-pointer ${isCalc ? "italic text-gray-500" : "text-gray-600"}`}
          title={label}
          onClick={() => toggleIds([r.id], !isSelected)}
        >
          <span className="block truncate">{label}</span>
        </span>
        {isCalc && r._total != null && (
          <span className={`text-[10px] shrink-0 ${r._total < 0 ? "text-red-500" : "text-gray-400"}`}>{fmtRp(r._total)}</span>
        )}
        {onSignChange && (
          <div className="flex items-center gap-0.5 shrink-0" title={sign === 1 ? "Penambahan" : "Pengurangan"}>
            <Switch
              checked={sign === -1}
              onCheckedChange={(v) => onSignChange({ ...(signs ?? {}), [r.id]: v ? -1 : 1 })}
              className="scale-75"
            />
            <span className={`text-[9px] font-bold w-3 ${sign === -1 ? "text-red-500" : "text-green-600"}`}>{sign === -1 ? "−" : "+"}</span>
          </div>
        )}
      </div>
    );
  };

  const toggleIds = (ids: string[], checked: boolean) => {
    const next = checked ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.includes(id));
    onChange(next);
  };
  const allSel = (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  const someSel = (ids: string[]) => ids.some((id) => selectedIds.includes(id));

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-50 whitespace-nowrap">
        {label} {count > 0 ? `${count} dipilih` : "Pilih..."}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl min-w-60 max-w-75 flex flex-col" style={{ maxHeight: 300 }}>
            {/* Sticky header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white rounded-t-lg shrink-0">
              <span className="text-[10px] font-semibold text-gray-600">Pilih item {count > 0 ? `(${count})` : ""}</span>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-xs leading-none">✕</button>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 p-1.5">
              {structure.length === 0 && topItems.length === 0 && (
                <p className="text-[10px] text-gray-400 italic px-2 py-1">Belum ada item</p>
              )}

              {structure.map(({ row: g, subs, directItems }) => (
                <div key={g.id} className="mb-1">
                  {/* Group itself selectable if has value */}
                  {(g._total || g.grandTotal || g.price) && renderItem({ ...g, description: g.label }, "px-2")}
                  {subs.map(({ row: sg, items }) => {
                    const sgIds = [sg.id, ...items.map((r) => r.id)];
                    return (
                      <div key={sg.id}>
                        <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 rounded text-[11px] font-semibold text-gray-700 bg-gray-50">
                          <Checkbox checked={allSel(sgIds)} indeterminate={!allSel(sgIds) && someSel(sgIds)} onCheckedChange={(v) => toggleIds(sgIds, !!v)} />
                          <span className="truncate">{sg.label || "(sub-group)"}</span>
                        </label>
                        {items.map((r) => renderItem(r, "pl-5"))}
                      </div>
                    );
                  })}
                  {directItems.map((r) => renderItem(r, "px-2"))}
                </div>
              ))}

              {topItems.map((r) => renderItem(r, "px-2"))}
            </div>

            {/* Sticky footer */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100 bg-white rounded-b-lg shrink-0">
              <button type="button" onClick={() => onChange([])} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>
              <button type="button" onClick={() => setOpen(false)} className="text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded hover:bg-gray-700">Selesai</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}