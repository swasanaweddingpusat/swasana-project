"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, ChevronRight, ChevronDown, Trash2, Plus } from "lucide-react";
import { SortableNodeRow } from "./sortable-node-row";
import { AddGroupButton, InlineAddItemForm } from "./helpers";
import type { PaketNode, CateringSection } from "@/types/catering";

interface Props {
  section: CateringSection;
  isViewOnly: boolean;
  allSections: CateringSection[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddGroup: (sectionId: string) => void;
  onAddRootItem: (sectionId: string, section: CateringSection, title?: string, qty?: number, unit?: string, price?: number) => void;
  onUpdateNode: (sId: string, nId: string, field: keyof PaketNode, value: unknown) => void;
  onRemoveNode: (sId: string, nId: string) => void;
  onAddChildGroup: (sId: string, parentId: string) => void;
  onAddChildItem: (sId: string, parentId: string, title?: string, qty?: number, unit?: string) => void;
  onAddMenuPilihan: (sId: string, sourceGroupId: string) => void;
  onAddChildMenuPilihan: (sId: string, parentId: string, sourceGroupId: string) => void;
  onNodeDragEnd: (sId: string, event: DragEndEvent) => void;
}

export function SortableSectionBlock(props: Props) {
  const { section, isViewOnly } = props;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id, disabled: isViewOnly });
  const [editingName, setEditingName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState(section.name);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showAddItemForm, setShowAddItemForm] = React.useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => { setNameInput(section.name); }, [section.name]);

  const commitName = () => {
    const t = nameInput.trim();
    if (t) props.onRename(section.id, t);
    else setNameInput(section.name);
    setEditingName(false);
  };

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="border border-gray-300 rounded-lg bg-white overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        {!isViewOnly && <button type="button" {...listeners} className="text-gray-300 hover:text-gray-400 cursor-grab shrink-0 touch-none"><GripVertical className="h-4 w-4" /></button>}
        <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} className="shrink-0 text-gray-400">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {editingName && !isViewOnly ? (
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameInput(section.name); setEditingName(false); } }}
            className="text-sm font-bold flex-1 border-0 border-b border-gray-300 outline-none bg-transparent" autoFocus />
        ) : (
          <button type="button" onClick={() => !isViewOnly && setEditingName(true)} className="text-sm font-bold text-gray-900 flex-1 text-left truncate">
            {section.name}
            <span className="text-xs font-normal text-gray-400 ml-1.5">({section.nodes.length} item)</span>
          </button>
        )}

        {!isViewOnly && (
          <button type="button" onClick={() => props.onDelete(section.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>

      {/* Section body */}
      {!isCollapsed && (
        <div className="px-3 py-2 space-y-1">
          {section.nodes.length === 0 && !showAddItemForm && <p className="text-xs text-gray-300 italic py-2 text-center">Section kosong</p>}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => props.onNodeDragEnd(section.id, e)}>
            <SortableContext items={section.nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              {section.nodes.map((node) => (
                <SortableNodeRow key={node.id} node={node} sectionId={section.id} isViewOnly={isViewOnly} depth={0}
                  allSections={props.allSections} onUpdateNode={props.onUpdateNode} onRemoveNode={props.onRemoveNode}
                  onAddChildGroup={props.onAddChildGroup} onAddChildItem={props.onAddChildItem}
                  onAddChildMenuPilihan={props.onAddChildMenuPilihan} onNodeDragEnd={props.onNodeDragEnd} />
              ))}
            </SortableContext>
          </DndContext>

          {showAddItemForm && (
            <InlineAddItemForm onConfirm={(title, qty, unit, price) => { props.onAddRootItem(section.id, section, title, qty, unit, price); setShowAddItemForm(false); }}
              onCancel={() => setShowAddItemForm(false)} />
          )}

          {!isViewOnly && (
            <div className="flex items-center gap-2 pt-1">
              <AddGroupButton section={section} onAddNormal={() => props.onAddGroup(section.id)} onAddMenuPilihan={(srcId) => props.onAddMenuPilihan(section.id, srcId)} />
              <button type="button" onClick={() => setShowAddItemForm(true)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50">
                <Plus className="h-3 w-3" /> Item
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
