"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Calculator, Merge } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { POCateringData, POSection, PORow, FormulaOp } from "@/types/po-catering";
import { calculateAll, createItemRow, createHeaderRow, createSubtotalRow, createSection, createId } from "@/types/po-catering";

function fmtRp(n: number): string {
  if (n === 0) return "Rp0";
  const prefix = n < 0 ? "-" : "";
  return `${prefix}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(n))}`;
}

interface Props {
  data: POCateringData;
  onChange: (data: POCateringData) => void;
  readOnly?: boolean;
}

export function POCateringEditor({ data, onChange, readOnly }: Props) {
  const computed = useMemo(() => calculateAll(data), [data]);

  const updateSections = useCallback(
    (fn: (sections: POSection[]) => POSection[]) => onChange({ ...data, sections: fn(data.sections) }),
    [data, onChange]
  );

  const updateRow = useCallback(
    (sectionId: string, rowId: string, patch: Partial<PORow>) => {
      updateSections((ss) => ss.map((s) => s.id !== sectionId ? s : { ...s, rows: s.rows.map((r) => r.id !== rowId ? r : { ...r, ...patch }) }));
    },
    [updateSections]
  );

  const addRow = useCallback(
    (sectionId: string, row: PORow, beforeSubtotal = true) => {
      updateSections((ss) => ss.map((s) => {
        if (s.id !== sectionId) return s;
        const rows = [...s.rows];
        if (beforeSubtotal) {
          const idx = rows.findIndex((r) => r.type === "subtotal" || r.type === "formula");
          if (idx >= 0) { rows.splice(idx, 0, row); return { ...s, rows }; }
        }
        rows.push(row);
        return { ...s, rows };
      }));
    },
    [updateSections]
  );

  const removeRow = useCallback(
    (sectionId: string, rowId: string) => {
      updateSections((ss) => ss.map((s) => s.id !== sectionId ? s : { ...s, rows: s.rows.filter((r) => r.id !== rowId) }));
    },
    [updateSections]
  );

  const moveRow = useCallback(
    (sectionId: string, rowId: string, dir: -1 | 1) => {
      updateSections((ss) => ss.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.rows.findIndex((r) => r.id === rowId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= s.rows.length) return s;
        const rows = [...s.rows];
        [rows[idx], rows[target]] = [rows[target], rows[idx]];
        return { ...s, rows };
      }));
    },
    [updateSections]
  );

  const addSection = useCallback(
    () => updateSections((ss) => [...ss, createSection("Section Baru")]),
    [updateSections]
  );

  const removeSection = useCallback(
    (id: string) => updateSections((ss) => ss.filter((s) => s.id !== id)),
    [updateSections]
  );

  const renameSection = useCallback(
    (id: string, name: string) => updateSections((ss) => ss.map((s) => s.id !== id ? s : { ...s, name })),
    [updateSections]
  );

  const updateSectionGrandTotal = useCallback(
    (id: string, value: number) => updateSections((ss) => ss.map((s) => s.id !== id ? s : { ...s, manualGrandTotal: value })),
    [updateSections]
  );

  return (
    <div className="w-full space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {!readOnly && <th className="border border-gray-300 px-1 py-1.5 w-[24px]" />}
              <th className="border border-gray-300 px-2 py-1.5 text-left w-[4%]">NO</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left w-[34%]">DESCRIPTION</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[8%]">JUMLAH</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[6%]">UNIT</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[14%]">HARGA SATUAN</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[15%]">TOTAL</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[15%]">GRAND TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {computed.sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                allSections={computed.sections}
                readOnly={readOnly}
                onUpdateRow={(rowId, patch) => updateRow(section.id, rowId, patch)}
                onAddRow={(row, before) => addRow(section.id, row, before)}
                onRemoveRow={(rowId) => removeRow(section.id, rowId)}
                onMoveRow={(rowId, dir) => moveRow(section.id, rowId, dir)}
                onRename={(name) => renameSection(section.id, name)}
                onUpdateGrandTotal={(val) => updateSectionGrandTotal(section.id, val)}
                onRemoveSection={() => removeSection(section.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add section */}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addSection} className="text-xs">
          <Plus className="h-3 w-3 mr-1" /> Tambah Section
        </Button>
      )}
    </div>
  );
}

// ─── Section Block ───────────────────────────────────────────────────────────

interface SectionProps {
  section: POSection & { _grandTotal?: number };
  allSections: POSection[];
  readOnly?: boolean;
  onUpdateRow: (rowId: string, patch: Partial<PORow>) => void;
  onAddRow: (row: PORow, beforeSubtotal?: boolean) => void;
  onRemoveRow: (rowId: string) => void;
  onMoveRow: (rowId: string, dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onUpdateGrandTotal: (value: number) => void;
  onRemoveSection: () => void;
}

function SectionBlock({ section, allSections, readOnly, onUpdateRow, onAddRow, onRemoveRow, onMoveRow, onRename, onUpdateGrandTotal, onRemoveSection }: SectionProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const colCount = readOnly ? 8 : 9;

  return (
    <>
      {/* Section header */}
      <tr className="bg-gray-50 group">
        {!readOnly && <td className="border border-gray-300 px-1 py-1" />}
        <td colSpan={6} className="border border-gray-300 px-2 py-1.5">
          {readOnly ? (
            <span className="font-bold text-xs uppercase">{section.name}</span>
          ) : (
            <input
              className="w-full bg-transparent outline-none font-bold text-xs uppercase"
              value={section.name}
              onChange={(e) => onRename(e.target.value)}
            />
          )}
        </td>
        <td className="border border-gray-300 px-2 py-1.5 text-right font-bold text-xs">
          <div className="flex items-center justify-end gap-1">
            {readOnly ? (
              <span>{section._grandTotal != null ? fmtRp(section._grandTotal) : ""}</span>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                className="w-full bg-transparent outline-none text-right font-bold text-xs"
                value={section.manualGrandTotal ? new Intl.NumberFormat("id-ID").format(section.manualGrandTotal) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  onUpdateGrandTotal(Number(raw) || 0);
                }}
                placeholder="0"
              />
            )}
            {!readOnly && (
              <button type="button" onClick={onRemoveSection} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-1 shrink-0">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Rows */}
      {section.rows.map((row) => (
        <RowRenderer
          key={row.id}
          row={row}
          allSections={allSections}
          readOnly={readOnly}
          onUpdate={(patch) => onUpdateRow(row.id, patch)}
          onRemove={() => onRemoveRow(row.id)}
          onMoveUp={() => onMoveRow(row.id, -1)}
          onMoveDown={() => onMoveRow(row.id, 1)}
        />
      ))}

      {/* Add row toolbar */}
      {!readOnly && (
        <tr>
          <td colSpan={colCount} className="border border-gray-300 px-2 py-1">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onAddRow(createItemRow({ no: section.rows.filter((r) => r.type === "item").length + 1 }))} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus className="h-3 w-3" /> Item
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => onAddRow(createHeaderRow("Header baru"), true)} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                <Merge className="h-3 w-3" /> Header
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => onAddRow(createSubtotalRow("Jumlah"), false)} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800">
                <Calculator className="h-3 w-3" /> Subtotal
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => onAddRow({ id: createId(), type: "formula", label: "Formula baru", formula: { kind: "sum" } }, false)} className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800">
                <Calculator className="h-3 w-3" /> Formula
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Row Renderer ────────────────────────────────────────────────────────────

interface RowProps {
  row: PORow;
  allSections: POSection[];
  readOnly?: boolean;
  onUpdate: (patch: Partial<PORow>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function RowRenderer({ row, allSections, readOnly, onUpdate, onRemove, onMoveUp, onMoveDown }: RowProps) {
  const actions = !readOnly && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
      <button type="button" onClick={onMoveUp} className="text-gray-400 hover:text-gray-600"><ChevronUp className="h-3 w-3" /></button>
      <button type="button" onClick={onMoveDown} className="text-gray-400 hover:text-gray-600"><ChevronDown className="h-3 w-3" /></button>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
    </div>
  );

  // ─── Header row (merged) ─────────────────────────────────────────────────
  if (row.type === "header") {
    return (
      <tr className="bg-white group">
        {!readOnly && <td className="border border-gray-300 px-1">{actions}</td>}
        <td colSpan={7} className="border border-gray-300 px-2 py-1 font-semibold text-xs">
          {readOnly ? row.label : (
            <input className="w-full bg-transparent outline-none font-semibold text-xs" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
          )}
        </td>
      </tr>
    );
  }

  // ─── Subtotal / Formula row ──────────────────────────────────────────────
  if (row.type === "subtotal" || row.type === "formula") {
    const isNeg = (row._total ?? 0) < 0;
    return (
      <tr className="bg-gray-50 font-semibold group">
        {!readOnly && <td className="border border-gray-300 px-1">{actions}</td>}
        <td className="border border-gray-300" />
        <td colSpan={2} className="border border-gray-300 px-2 py-1 text-xs">
          {readOnly ? row.label : (
            <input className="w-full bg-transparent outline-none text-xs font-semibold" value={row.label ?? ""} onChange={(e) => onUpdate({ label: e.target.value })} />
          )}
        </td>
        {/* Formula selector */}
        <td colSpan={2} className="border border-gray-300 px-1 py-0.5">
          {!readOnly && row.formula && (
            <FormulaSelector formula={row.formula} allSections={allSections} onChange={(f) => onUpdate({ formula: f })} />
          )}
        </td>
        <td className={cn("border border-gray-300 px-2 py-1 text-right text-xs", isNeg && "text-red-600")}>
          {fmtRp(row._total ?? 0)}
        </td>
        <td className="border border-gray-300" />
      </tr>
    );
  }

  // ─── Item row ────────────────────────────────────────────────────────────
  return (
    <tr className="hover:bg-blue-50/30 group">
      {!readOnly && <td className="border border-gray-300 px-1">{actions}</td>}
      <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500">{row.no ?? ""}</td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="text-xs px-1">{row.description}</span> : (
          <input className="w-full bg-transparent outline-none text-xs px-1 py-0.5" value={row.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="Nama item..." />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-right text-xs">{row.qty ?? ""}</span> : (
          <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.qty ?? ""} onChange={(e) => onUpdate({ qty: Number(e.target.value) || 0 })} />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-center text-xs">{row.unit ?? ""}</span> : (
          <input className="w-full bg-transparent outline-none text-center text-xs px-1 py-0.5" value={row.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value })} />
        )}
      </td>
      <td className="border border-gray-300 px-1 py-0.5">
        {readOnly ? <span className="block text-right text-xs">{row.price ? fmtRp(row.price) : ""}</span> : (
          <input type="number" className="w-full bg-transparent outline-none text-right text-xs px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={row.price ?? ""} onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })} />
        )}
      </td>
      <td className={cn("border border-gray-300 px-2 py-1 text-right text-xs", row.negative && "text-red-600")}>
        {row._total != null && row._total !== 0 ? fmtRp(row._total) : ""}
      </td>
      <td className="border border-gray-300 px-2 py-1 text-center">
        {!readOnly && (
          <label className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
            <input type="checkbox" checked={row.negative ?? false} onChange={(e) => onUpdate({ negative: e.target.checked })} className="h-3 w-3" />
            (-)
          </label>
        )}
      </td>
    </tr>
  );
}

// ─── Formula Selector ────────────────────────────────────────────────────────

function FormulaSelector({ formula, allSections, onChange }: { formula: FormulaOp; allSections: POSection[]; onChange: (f: FormulaOp) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <select
        className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5"
        value={formula.kind}
        onChange={(e) => {
          const kind = e.target.value as FormulaOp["kind"];
          if (kind === "sum") onChange({ kind: "sum" });
          else if (kind === "diff") onChange({ kind: "diff", a: allSections[0]?.id ?? "", b: allSections[1]?.id ?? "" });
          else if (kind === "sum_sections") onChange({ kind: "sum_sections", ids: [] });
          else if (kind === "percent") onChange({ kind: "percent", value: 0, of: allSections[0]?.id ?? "" });
          else if (kind === "negate") onChange({ kind: "negate" });
        }}
      >
        <option value="sum">SUM (section ini)</option>
        <option value="diff">SELISIH (A - B)</option>
        <option value="sum_sections">SUM (sections)</option>
        <option value="percent">PERSEN (%)</option>
        <option value="negate">NEGATE (-)</option>
      </select>

      {formula.kind === "diff" && (
        <>
          <SectionPicker label="A" value={formula.a} sections={allSections} onChange={(a) => onChange({ ...formula, a })} />
          <span className="text-[10px]">−</span>
          <SectionPicker label="B" value={formula.b} sections={allSections} onChange={(b) => onChange({ ...formula, b })} />
        </>
      )}

      {formula.kind === "sum_sections" && (
        <div className="flex flex-wrap gap-1">
          {allSections.map((s) => (
            <label key={s.id} className="flex items-center gap-0.5 text-[10px]">
              <input
                type="checkbox"
                className="h-2.5 w-2.5"
                checked={formula.ids.includes(s.id)}
                onChange={(e) => {
                  const ids = e.target.checked ? [...formula.ids, s.id] : formula.ids.filter((i) => i !== s.id);
                  onChange({ ...formula, ids });
                }}
              />
              {s.name.slice(0, 15)}
            </label>
          ))}
        </div>
      )}

      {formula.kind === "percent" && (
        <>
          <input
            type="number"
            className="w-10 text-[10px] border border-gray-200 rounded px-1 py-0.5 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={formula.value}
            onChange={(e) => onChange({ ...formula, value: Number(e.target.value) || 0 })}
          />
          <span className="text-[10px]">% of</span>
          <SectionPicker label="" value={formula.of} sections={allSections} onChange={(of) => onChange({ ...formula, of })} />
        </>
      )}
    </div>
  );
}

function SectionPicker({ label, value, sections, onChange }: { label: string; value: string; sections: POSection[]; onChange: (id: string) => void }) {
  return (
    <select
      className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 max-w-[100px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label || "Pilih"}</option>
      {sections.map((s) => (
        <option key={s.id} value={s.id}>{s.name.slice(0, 20)}</option>
      ))}
    </select>
  );
}
