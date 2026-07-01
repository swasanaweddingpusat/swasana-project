"use client";

import React, { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleEditor } from "@/components/ui/simple-editor";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AddCircle,
  TrashBinTrash,
  AlignVerticalSpacing,
  Settings,
  UsersGroupRounded,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/use-categories";
import { createCategory } from "@/actions/category";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackageInternalItemDraft {
  uid: string;
  itemName: string;
  itemDescription: string;
}

export interface PackageVendorItemDraft {
  uid: string;
  categoryId: string | null;
  categoryName: string;
  itemText: string;
}

export type PackageItemsTab = "internal" | "vendor";

interface PackageItemsEditorProps {
  internalItems: PackageInternalItemDraft[];
  vendorItems: PackageVendorItemDraft[];
  onInternalChange: (items: PackageInternalItemDraft[]) => void;
  onVendorChange: (items: PackageVendorItemDraft[]) => void;
  /** Controlled active tab (optional). When omitted the component manages its own. */
  activeTab?: PackageItemsTab;
  onTabChange?: (tab: PackageItemsTab) => void;
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableRow({
  id,
  onDelete,
  children,
}: {
  id: string;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 space-y-3",
        isDragging && "opacity-50 shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-3">{children}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="mt-0.5 shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────
// Controlled, presentational-ish editor: owns no item state, mutates via the
// onChange callbacks. Reused by EditPackageDrawer (edit booking) and the
// create/edit booking wizard "Item Paket" step. Vendor categories come from the
// same master + createCategory flow as the package drawer.

export function PackageItemsEditor({
  internalItems,
  vendorItems,
  onInternalChange,
  onVendorChange,
  activeTab: controlledTab,
  onTabChange,
}: PackageItemsEditorProps) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { data: categories = [] } = useCategories();

  const [internalTab, setInternalTab] = React.useState<PackageItemsTab>("internal");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = useCallback(
    (tab: PackageItemsTab) => {
      if (onTabChange) onTabChange(tab);
      else setInternalTab(tab);
    },
    [onTabChange],
  );

  // ── Internal items handlers ─────────────────────────────────────────────────
  const addInternalItem = useCallback(() => {
    onInternalChange([...internalItems, { uid: crypto.randomUUID(), itemName: "", itemDescription: "" }]);
  }, [internalItems, onInternalChange]);

  const removeInternalItem = useCallback(
    (uid: string) => {
      onInternalChange(internalItems.filter((i) => i.uid !== uid));
    },
    [internalItems, onInternalChange],
  );

  const updateInternalItem = useCallback(
    (uid: string, field: "itemName" | "itemDescription", value: string) => {
      onInternalChange(internalItems.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)));
    },
    [internalItems, onInternalChange],
  );

  const handleInternalDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const from = internalItems.findIndex((i) => i.uid === active.id);
        const to = internalItems.findIndex((i) => i.uid === over.id);
        onInternalChange(arrayMove(internalItems, from, to));
      }
    },
    [internalItems, onInternalChange],
  );

  // ── Vendor items handlers ───────────────────────────────────────────────────
  const addVendorItem = useCallback(() => {
    onVendorChange([
      ...vendorItems,
      { uid: crypto.randomUUID(), categoryId: null, categoryName: "", itemText: "" },
    ]);
  }, [vendorItems, onVendorChange]);

  const removeVendorItem = useCallback(
    (uid: string) => {
      onVendorChange(vendorItems.filter((i) => i.uid !== uid));
    },
    [vendorItems, onVendorChange],
  );

  const setVendorItemCategory = useCallback(
    (uid: string, categoryId: string | null, categoryName: string) => {
      onVendorChange(vendorItems.map((i) => (i.uid === uid ? { ...i, categoryId, categoryName } : i)));
    },
    [vendorItems, onVendorChange],
  );

  const updateVendorItemText = useCallback(
    (uid: string, value: string) => {
      onVendorChange(vendorItems.map((i) => (i.uid === uid ? { ...i, itemText: value } : i)));
    },
    [vendorItems, onVendorChange],
  );

  const handleVendorDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const from = vendorItems.findIndex((i) => i.uid === active.id);
        const to = vendorItems.findIndex((i) => i.uid === over.id);
        onVendorChange(arrayMove(vendorItems, from, to));
      }
    },
    [vendorItems, onVendorChange],
  );

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col">
      {/* ── Tab navigation — underline style ───────────────────────── */}
      <div className="border-b border-border mb-4">
        <div className="flex">
          {(["internal", "vendor"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {tab === "internal" && <Settings weight="BoldDuotone" className="h-4 w-4 shrink-0" />}
                {tab === "vendor" && <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 shrink-0" />}
                <span className="capitalize">{tab === "internal" ? "Internal" : "Vendor"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Internal Items ─────────────────────────────────────────── */}
      {activeTab === "internal" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Item internal paket yang tampil di PO booking.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInternalDragEnd}>
            <SortableContext items={internalItems.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {internalItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
                    Belum ada item internal.
                  </p>
                )}
                {internalItems.map((item) => (
                  <SortableRow key={item.uid} id={item.uid} onDelete={() => removeInternalItem(item.uid)}>
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateInternalItem(item.uid, "itemName", e.target.value)}
                      placeholder="Nama item..."
                      className="font-medium"
                    />
                    <SimpleEditor
                      value={item.itemDescription}
                      onChange={(html) => updateInternalItem(item.uid, "itemDescription", html)}
                      placeholder="Deskripsi item..."
                    />
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="outline"
            onClick={addInternalItem}
            className="w-full border-dashed rounded-xl"
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" />
            Tambah Item Internal
          </Button>
        </div>
      )}

      {/* ── Vendor Items ───────────────────────────────────────────── */}
      {activeTab === "vendor" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Item vendor per kategori yang tampil di PO booking.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVendorDragEnd}>
            <SortableContext items={vendorItems.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {vendorItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
                    Belum ada item vendor.
                  </p>
                )}
                {vendorItems.map((item) => (
                  <SortableRow key={item.uid} id={item.uid} onDelete={() => removeVendorItem(item.uid)}>
                    <SearchableSelect
                      options={categoryOptions}
                      value={item.categoryId ?? ""}
                      onChange={(val) => {
                        if (!val) {
                          // Defensive: a cleared selection must also clear the stored
                          // category, otherwise a stale categoryId would be submitted.
                          setVendorItemCategory(item.uid, null, "");
                          return;
                        }
                        const cat = categories.find((c) => c.id === val);
                        if (cat) setVendorItemCategory(item.uid, cat.id, cat.name);
                      }}
                      placeholder="Pilih kategori..."
                      searchPlaceholder="Cari kategori..."
                      emptyText="Kategori tidak ditemukan"
                      onAdd={async (name) => {
                        const res = await createCategory(name);
                        if (!res.success) {
                          toast.error(res.error ?? "Gagal menambahkan");
                          return;
                        }
                        await qc.invalidateQueries({ queryKey: ["categories"] });
                        setVendorItemCategory(item.uid, res.category.id, res.category.name);
                        toast.success(`Kategori "${res.category.name}" ditambahkan`);
                      }}
                    />
                    <SimpleEditor
                      value={item.itemText}
                      onChange={(html) => updateVendorItemText(item.uid, html)}
                      placeholder="Deskripsi item vendor..."
                    />
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="outline"
            onClick={addVendorItem}
            className="w-full border-dashed rounded-xl"
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" />
            Tambah Item Vendor
          </Button>
        </div>
      )}
    </div>
  );
}
