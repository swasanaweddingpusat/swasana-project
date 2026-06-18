"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleEditor } from "@/components/ui/simple-editor";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AddCircle,
  TrashBinTrash,
  AlignVerticalSpacing,
  Settings,
  UsersGroupRounded,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import {
  saveSnapInternalItems,
  saveSnapVendorItems,
} from "@/actions/snap-package-items";
import type { BookingDetail } from "@/lib/queries/bookings";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditPackageTarget {
  bookingId: string;
  customerName: string;
}

interface InternalItemState {
  uid: string;
  itemName: string;
  itemDescription: string;
}

interface VendorItemState {
  uid: string;
  categoryName: string;
  itemText: string;
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableRow({ id, onDelete, children }: { id: string; onDelete: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-2xl border border-border bg-card p-4 space-y-3", isDragging && "opacity-50 shadow-md")}
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

// ─── Inner Content — mounts only after bookingDetail is available ─────────────
// State is initialized once from bookingDetail at mount time via useState lazy
// initializer. No effects needed: the parent's key prop ensures this component
// remounts fresh whenever the booking changes, so stale state is never an issue.

type TabValue = "internal" | "vendor";

interface EditPackageContentProps {
  bookingDetail: BookingDetail;
  target: EditPackageTarget;
  onClose: () => void;
}

function EditPackageContent({ bookingDetail, target, onClose }: EditPackageContentProps) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeTab, setActiveTab] = useState<TabValue>("internal");

  // State initialized once at mount from bookingDetail — no effects required.
  const [internalItems, setInternalItems] = useState<InternalItemState[]>(() =>
    (bookingDetail.snapPackageInternalItems ?? []).map((i) => ({
      uid: i.id,
      itemName: i.itemName,
      itemDescription: i.itemDescription,
    })),
  );
  const [vendorItems, setVendorItems] = useState<VendorItemState[]>(() =>
    (bookingDetail.snapPackageVendorItems ?? []).map((i) => ({
      uid: i.id,
      categoryName: i.categoryName,
      itemText: i.itemText,
    })),
  );
  // ── Saving state ──────────────────────────────────────────────────────────
  const [savingInternal, setSavingInternal] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);

  // ── Internal items handlers ───────────────────────────────────────────────
  const addInternalItem = useCallback(() => {
    setInternalItems((prev) => [...prev, { uid: crypto.randomUUID(), itemName: "", itemDescription: "" }]);
  }, []);

  const removeInternalItem = useCallback((uid: string) => {
    setInternalItems((prev) => prev.filter((i) => i.uid !== uid));
  }, []);

  const updateInternalItem = useCallback((uid: string, field: keyof InternalItemState, value: string) => {
    setInternalItems((prev) => prev.map((i) => i.uid === uid ? { ...i, [field]: value } : i));
  }, []);

  const handleInternalDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setInternalItems((prev) => {
        const from = prev.findIndex((i) => i.uid === active.id);
        const to = prev.findIndex((i) => i.uid === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }, []);

  const saveInternal = useCallback(async () => {
    const emptyItem = internalItems.find((i) => !i.itemName.trim());
    if (emptyItem) { toast.error("Nama item tidak boleh kosong."); return; }
    setSavingInternal(true);
    const res = await saveSnapInternalItems({
      bookingId: target.bookingId,
      items: internalItems.map((i, idx) => ({ itemName: i.itemName, itemDescription: i.itemDescription, sortOrder: idx })),
    });
    setSavingInternal(false);
    if (!res.success) { toast.error(res.error ?? "Gagal menyimpan."); return; }
    toast.success("Item internal berhasil disimpan.");
    await qc.invalidateQueries({ queryKey: ["booking-detail", target.bookingId] });
  }, [target.bookingId, internalItems, qc]);

  // ── Vendor items handlers ─────────────────────────────────────────────────
  const addVendorItem = useCallback(() => {
    setVendorItems((prev) => [...prev, { uid: crypto.randomUUID(), categoryName: "", itemText: "" }]);
  }, []);

  const removeVendorItem = useCallback((uid: string) => {
    setVendorItems((prev) => prev.filter((i) => i.uid !== uid));
  }, []);

  const updateVendorItem = useCallback((uid: string, field: keyof VendorItemState, value: unknown) => {
    setVendorItems((prev) => prev.map((i) => i.uid === uid ? { ...i, [field]: value } : i));
  }, []);

  const handleVendorDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setVendorItems((prev) => {
        const from = prev.findIndex((i) => i.uid === active.id);
        const to = prev.findIndex((i) => i.uid === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }, []);

  const saveVendor = useCallback(async () => {
    const emptyItem = vendorItems.find((i) => !i.categoryName.trim() || !i.itemText.trim());
    if (emptyItem) { toast.error("Nama kategori dan item text tidak boleh kosong."); return; }
    setSavingVendor(true);
    const res = await saveSnapVendorItems({
      bookingId: target.bookingId,
      items: vendorItems.map((i, idx) => ({ categoryName: i.categoryName, itemText: i.itemText, sortOrder: idx })),
    });
    setSavingVendor(false);
    if (!res.success) { toast.error(res.error ?? "Gagal menyimpan."); return; }
    toast.success("Item vendor berhasil disimpan.");
    await qc.invalidateQueries({ queryKey: ["booking-detail", target.bookingId] });
  }, [target.bookingId, vendorItems, qc]);

  // ── Derived save handler & state for active tab ───────────────────────────
  const isSaving = activeTab === "internal" ? savingInternal : savingVendor;

  const handleSave = useCallback(() => {
    if (activeTab === "internal") return saveInternal();
    return saveVendor();
  }, [activeTab, saveInternal, saveVendor]);

  const saveLabelMap: Record<TabValue, string> = {
    internal: savingInternal ? "Menyimpan..." : "Simpan Item Internal",
    vendor: savingVendor ? "Menyimpan..." : "Simpan Item Vendor",
  };

  return (
    <div className="flex flex-col min-h-full">
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

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div className="flex-1">
        {/* Internal Items */}
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

        {/* Vendor Items */}
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
                      <Input
                        value={item.categoryName}
                        onChange={(e) => updateVendorItem(item.uid, "categoryName", e.target.value)}
                        placeholder="Nama kategori vendor..."
                        className="font-medium"
                      />
                      <SimpleEditor
                        value={item.itemText}
                        onChange={(html) => updateVendorItem(item.uid, "itemText", html)}
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

      {/* ── Sticky footer ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 mt-6 border-t border-border bg-background pt-4 pb-1">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl"
          >
            {saveLabelMap[activeTab]}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shell — handles Drawer wrapper + data fetching ──────────────────────────
// The parent passes key={target?.bookingId ?? "none"} so this component remounts
// fresh for each booking, ensuring EditPackageContent's lazy initializers run
// with the correct bookingDetail every time.

interface EditPackageDrawerProps {
  target: EditPackageTarget | null;
  onClose: () => void;
}

export function EditPackageDrawer({ target, onClose }: EditPackageDrawerProps) {
  const { data: bookingDetail, isLoading: isLoadingDetail } = useQuery<BookingDetail>({
    queryKey: ["booking-detail", target?.bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${target!.bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking detail");
      return res.json() as Promise<BookingDetail>;
    },
    enabled: !!target?.bookingId,
    staleTime: 0,
  });

  return (
    <Drawer
      isOpen={!!target}
      onClose={onClose}
      title={target ? `Edit Package — ${target.customerName}` : "Edit Package"}
      maxWidth="sm:max-w-2xl"
    >
      {isLoadingDetail || !bookingDetail || !target ? (
        <div className="space-y-4 p-1">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : (
        <EditPackageContent
          bookingDetail={bookingDetail}
          target={target}
          onClose={onClose}
        />
      )}
    </Drawer>
  );
}
