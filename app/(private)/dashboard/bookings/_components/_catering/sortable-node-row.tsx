"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Input } from "@/components/ui/input";
import { GripVertical, ChevronRight, ChevronDown, Trash2, Plus, FolderPlus } from "lucide-react";
import { CurrencyInput } from "./helpers";
import { EDITOR_OPERATION_STYLES } from "@/types/catering";
import type { PaketNode, CateringSection, GroupOperationType, GroupMode } from "@/types/catering";
import { calcGroupTotal } from "@/types/catering";

interface SortableNodeRowProps {
  node: PaketNode;
  sectionId: string;
  isViewOnly: boolean;
  depth: number;
  allSections: CateringSection[];
  onUpdateNode: (sId: string, nId: string, field: keyof PaketNode, value: unknown) => void;
  onRemoveNode: (sId: string, nId: string) => void;
  onAddChildGroup: (sId: string, parentId: string) => void;
  onAddChildItem: (sId: string, parentId: string, title?: string, qty?: number, unit?: string) => void;
  onAddChildMenuPilihan?: (sId: string, parentId: string, sourceGroupId: string) => void;
  onNodeDragEnd: (sId: string, event: DragEndEvent) => void;
}

export function SortableNodeRow(props: SortableNodeRowProps) {
  const { node, sectionId, isViewOnly, depth, allSections, onUpdateNode, onRemoveNode, onAddChildGroup, onAddChildItem, onNodeDragEnd } = props;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: node.id, disabled: isViewOnly });
  const [collapsed, setCollapsed] = React.useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const style = { transform: CSS.Transform.toString(transform), transition };
  const total = calcGroupTotal(node, allSections);
  const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  if (node.type === "item") {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 py-1 hover:bg-gray-50 rounded px-1" {...attributes}>
        {!isViewOnly && <button type="button" {...listeners} className="text-gray-300 hover:text-gray-400 cursor-grab shrink-0 touch-none"><GripVertical className="h-3.5 w-3.5" /></button>}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {!isViewOnly ? (
            <>
              <Input value={node.title} onChange={(e) => onUpdateNode(sectionId, node.id, "title", e.target.value)} placeholder="Nama item" className="h-6 text-xs flex-1 min-w-[80px]" />
              <Input type="number" value={node.qty ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "qty", parseInt(e.target.value) || 0)} className="h-6 text-xs w-14 text-center" placeholder="Qty" />
              <Input value={node.unit ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "unit", e.target.value)} placeholder="Unit" className="h-6 text-xs w-14" />
              <CurrencyInput value={node.price ?? undefined} onChange={(v) => onUpdateNode(sectionId, node.id, "price", v)} className="w-24 shrink-0" />
            </>
          ) : (
            <>
              <span className="text-xs text-gray-700 flex-1 truncate">{node.title || "-"}</span>
              {node.qty != null && <span className="text-[10px] text-gray-400">{node.qty} {node.unit ?? ""}</span>}
            </>
          )}
        </div>
        <span className="text-xs font-medium text-gray-600 shrink-0 w-20 text-right">{fmt(total)}</span>
        {!isViewOnly && (
          <button type="button" onClick={() => onRemoveNode(sectionId, node.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
    );
  }

  // Group node
  const opType = node.group_operation_type ?? "bawaan";
  const mode = node.group_mode ?? "per_qty";
  const children = node.children_items ?? [];

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="border border-gray-200 rounded-lg overflow-hidden" >
      {/* Group header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50">
        {!isViewOnly && <button type="button" {...listeners} className="text-gray-300 hover:text-gray-400 cursor-grab shrink-0 touch-none"><GripVertical className="h-3.5 w-3.5" /></button>}
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="shrink-0 text-gray-400">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {!isViewOnly ? (
          <Input value={node.title} onChange={(e) => onUpdateNode(sectionId, node.id, "title", e.target.value)} placeholder="Nama group" className="h-6 text-xs font-semibold flex-1 min-w-[80px]" />
        ) : (
          <span className="text-xs font-semibold text-gray-900 flex-1 truncate">{node.title || "Untitled"}</span>
        )}

        {node.is_menu_pilihan && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">Menu Pilihan</span>}

        {/* Operation type selector */}
        {!isViewOnly ? (
          <select value={opType} onChange={(e) => onUpdateNode(sectionId, node.id, "group_operation_type", e.target.value as GroupOperationType)}
            className="h-6 text-[10px] border rounded px-1 shrink-0 cursor-pointer" style={{ borderColor: EDITOR_OPERATION_STYLES.border.default }}>
            <option value="bawaan">Bawaan</option>
            <option value="penambahan">Penambahan</option>
            <option value="pengurangan">Pengurangan</option>
            <option value="charge">Charge</option>
            <option value="discount">Discount</option>
            <option value="pembayaran">Pembayaran</option>
            <option value="group">Group</option>
          </select>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium shrink-0">{opType}</span>
        )}

        {/* Mode selector (hidden for "group" operation type) */}
        {opType !== "group" && !isViewOnly && (
          <select value={mode} onChange={(e) => onUpdateNode(sectionId, node.id, "group_mode", e.target.value as GroupMode)}
            className="h-6 text-[10px] border rounded px-1 shrink-0 cursor-pointer" style={{ borderColor: EDITOR_OPERATION_STYLES.border.default }}>
            <option value="per_qty">Per Qty</option>
            <option value="paketan">Paketan</option>
            <option value="persentase">Persentase</option>
            <option value="flat">Flat</option>
          </select>
        )}

        {/* Mode-specific inputs */}
        {(mode === "paketan" || mode === "flat") && opType !== "group" && !isViewOnly && (
          <CurrencyInput value={node.price ?? undefined} onChange={(v) => onUpdateNode(sectionId, node.id, "price", v)} className="w-24 shrink-0" />
        )}
        {mode === "paketan" && opType !== "group" && !isViewOnly && (
          <Input type="number" value={node.qty ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "qty", parseInt(e.target.value) || 0)} className="h-6 text-xs w-14 text-center" placeholder="Qty" />
        )}
        {mode === "per_qty" && (opType === "charge" || opType === "discount") && !isViewOnly && (
          <>
            <Input type="number" value={node.qty ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "qty", parseInt(e.target.value) || 0)} className="h-6 text-xs w-14 text-center" placeholder="Qty" />
            <Input value={node.unit ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "unit", e.target.value)} placeholder="Unit" className="h-6 text-xs w-14" />
            <CurrencyInput value={node.price ?? undefined} onChange={(v) => onUpdateNode(sectionId, node.id, "price", v)} className="w-24 shrink-0" />
          </>
        )}
        {mode === "persentase" && opType !== "group" && !isViewOnly && (
          <>
            <div className="relative w-16">
              <Input type="number" value={node.persentase_value ?? ""} onChange={(e) => onUpdateNode(sectionId, node.id, "persentase_value", parseFloat(e.target.value) || 0)} className="h-6 text-xs pr-5 pl-1" placeholder="%" />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
            </div>
          </>
        )}

        <span className="text-xs font-medium text-gray-700 shrink-0 w-24 text-right">{fmt(total)}</span>

        {!isViewOnly && (
          <button type="button" onClick={() => onRemoveNode(sectionId, node.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {/* Children */}
      {!collapsed && (
        <div className="pl-4 pr-2 py-1 space-y-0.5">
          {children.length === 0 && <p className="text-[10px] text-gray-300 italic py-1 px-1">Kosong</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onNodeDragEnd(sectionId, e)}>
            <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {children.map((child) => (
                <SortableNodeRow key={child.id} {...props} node={child} depth={depth + 1} />
              ))}
            </SortableContext>
          </DndContext>
          {!isViewOnly && (
            <div className="flex gap-2 py-1">
              <button type="button" onClick={() => onAddChildGroup(sectionId, node.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"><FolderPlus className="h-3 w-3" /> Group</button>
              <button type="button" onClick={() => onAddChildItem(sectionId, node.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"><Plus className="h-3 w-3" /> Item</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
