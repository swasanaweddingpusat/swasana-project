"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AddCircle,
  TrashBinTrash,
  MenuDots,
  Settings,
  UsersGroupRounded,
  Gift,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import {
  saveSnapInternalItems,
  saveSnapVendorItems,
  saveSnapComplimentaries,
} from "@/actions/snap-package-items";
import { useComplimentaries } from "@/hooks/use-complimentaries";
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

interface ComplimentaryItemState {
  uid: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description: string | null;
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
          className="mt-1 shrink-0 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
          tabIndex={-1}
        >
          <MenuDots weight="BoldDuotone" className="h-4 w-4" />
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface EditPackageDrawerProps {
  target: EditPackageTarget | null;
  onClose: () => void;
}

type TabValue = "internal" | "vendor" | "complimentary";

export function EditPackageDrawer({ target, onClose }: EditPackageDrawerProps) {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeTab, setActiveTab] = useState<TabValue>("internal");

  // ── Fetch booking detail ──────────────────────────────────────────────────
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

  // ── Complimentary master list ─────────────────────────────────────────────
  const { data: complimentaryList } = useComplimentaries({ activeOnly: true, pageSize: 200 });
  const complimentaryOptions = complimentaryList?.items ?? [];

  // ── Local state ───────────────────────────────────────────────────────────
  const [internalItems, setInternalItems] = useState<InternalItemState[]>([]);
  const [vendorItems, setVendorItems] = useState<VendorItemState[]>([]);
  const [complItems, setComplItems] = useState<ComplimentaryItemState[]>([]);

  // Populate state from fetched detail
  useEffect(() => {
    if (!bookingDetail) return;
    setInternalItems(
      (bookingDetail.snapPackageInternalItems ?? []).map((i) => ({
        uid: i.id,
        itemName: i.itemName,
        itemDescription: i.itemDescription,
      })),
    );
    setVendorItems(
      (bookingDetail.snapPackageVendorItems ?? []).map((i) => ({
        uid: i.id,
        categoryName: i.categoryName,
        itemText: i.itemText,
      })),
    );
    setComplItems(
      (bookingDetail.snapComplimentaries ?? []).map((i) => ({
        uid: i.id,
        complimentaryId: i.complimentaryId ?? null,
        name: i.name,
        price: i.price,
        isShowPrice: i.isShowPrice,
        description: i.description ?? null,
      })),
    );
  }, [bookingDetail]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!target) {
      setInternalItems([]);
      setVendorItems([]);
      setComplItems([]);
    }
  }, [target]);

  // ── Saving state ──────────────────────────────────────────────────────────
  const [savingInternal, setSavingInternal] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [savingCompl, setSavingCompl] = useState(false);

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
    if (!target) return;
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
  }, [target, internalItems, qc]);

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
    if (!target) return;
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
  }, [target, vendorItems, qc]);

  // ── Complimentary handlers ────────────────────────────────────────────────
  const addComplItem = useCallback(() => {
    setComplItems((prev) => [...prev, { uid: crypto.randomUUID(), complimentaryId: null, name: "", price: 0, isShowPrice: false, description: null }]);
  }, []);

  const removeComplItem = useCallback((uid: string) => {
    setComplItems((prev) => prev.filter((i) => i.uid !== uid));
  }, []);

  const updateComplItem = useCallback((uid: string, field: keyof ComplimentaryItemState, value: unknown) => {
    setComplItems((prev) => prev.map((i) => i.uid === uid ? { ...i, [field]: value } : i));
  }, []);

  const handleComplDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setComplItems((prev) => {
        const from = prev.findIndex((i) => i.uid === active.id);
        const to = prev.findIndex((i) => i.uid === over.id);
        return arrayMove(prev, from, to);
      });
    }
  }, []);

  const pickComplimentary = useCallback((uid: string, complId: string) => {
    const found = complimentaryOptions.find((c) => c.id === complId);
    if (!found) return;
    setComplItems((prev) => prev.map((i) => i.uid === uid
      ? { ...i, complimentaryId: found.id, name: found.name, price: found.price, isShowPrice: found.isShowPrice, description: found.description ?? null }
      : i,
    ));
  }, [complimentaryOptions]);

  const saveCompl = useCallback(async () => {
    if (!target) return;
    const emptyItem = complItems.find((i) => !i.name.trim());
    if (emptyItem) { toast.error("Nama complimentary tidak boleh kosong."); return; }
    setSavingCompl(true);
    const res = await saveSnapComplimentaries({
      bookingId: target.bookingId,
      items: complItems.map((i, idx) => ({ complimentaryId: i.complimentaryId ?? null, name: i.name, price: i.price, isShowPrice: i.isShowPrice, description: i.description ?? null, qty: 1, sortOrder: idx })),
    });
    setSavingCompl(false);
    if (!res.success) { toast.error(res.error ?? "Gagal menyimpan."); return; }
    toast.success("Complimentary berhasil disimpan.");
    await qc.invalidateQueries({ queryKey: ["booking-detail", target.bookingId] });
  }, [target, complItems, qc]);

  // ── Derived save handler & state for active tab ───────────────────────────
  const isSaving = activeTab === "internal" ? savingInternal : activeTab === "vendor" ? savingVendor : savingCompl;

  const handleSave = useCallback(() => {
    if (activeTab === "internal") return saveInternal();
    if (activeTab === "vendor") return saveVendor();
    return saveCompl();
  }, [activeTab, saveInternal, saveVendor, saveCompl]);

  const saveLabelMap: Record<TabValue, string> = {
    internal: savingInternal ? "Menyimpan..." : "Simpan Item Internal",
    vendor: savingVendor ? "Menyimpan..." : "Simpan Item Vendor",
    complimentary: savingCompl ? "Menyimpan..." : "Simpan Complimentary",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={!!target}
      onClose={onClose}
      title={target ? `Edit Package — ${target.customerName}` : "Edit Package"}
      maxWidth="sm:max-w-2xl"
    >
      {isLoadingDetail ? (
        <div className="space-y-4 p-1">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          {/* ── Tab navigation — underline style ───────────────────────── */}
          <div className="border-b border-border mb-4">
            <div className="flex">
              {(["internal", "vendor", "complimentary"] as const).map((tab) => {
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
                    {tab === "complimentary" && <Gift weight="BoldDuotone" className="h-4 w-4 shrink-0" />}
                    <span className="capitalize">{tab === "complimentary" ? "Complimentary" : tab === "internal" ? "Internal" : "Vendor"}</span>
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

            {/* Complimentary */}
            {activeTab === "complimentary" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Complimentary yang disertakan dalam booking.
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleComplDragEnd}>
                  <SortableContext items={complItems.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {complItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
                          Belum ada complimentary.
                        </p>
                      )}
                      {complItems.map((item) => (
                        <SortableRow key={item.uid} id={item.uid} onDelete={() => removeComplItem(item.uid)}>
                          <SearchableSelect
                            options={complimentaryOptions.map((c) => ({ id: c.id, name: c.name }))}
                            value={item.complimentaryId ?? ""}
                            onChange={(val) => pickComplimentary(item.uid, val)}
                            placeholder="Pilih complimentary..."
                            searchPlaceholder="Cari complimentary..."
                            emptyText="Tidak ditemukan"
                            className="w-full"
                          />
                          <Input
                            value={item.name}
                            onChange={(e) => updateComplItem(item.uid, "name", e.target.value)}
                            placeholder="Nama complimentary..."
                            className="font-medium"
                          />
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Harga</Label>
                            <Input
                              type="number"
                              min={0}
                              value={item.price}
                              onChange={(e) => updateComplItem(item.uid, "price", Math.max(0, Number(e.target.value)))}
                              className="h-8"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`show-price-${item.uid}`}
                              checked={item.isShowPrice}
                              onCheckedChange={(v) => updateComplItem(item.uid, "isShowPrice", v)}
                            />
                            <Label htmlFor={`show-price-${item.uid}`} className="text-sm text-muted-foreground cursor-pointer">
                              Tampil harga
                            </Label>
                          </div>
                        </SortableRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addComplItem}
                  className="w-full border-dashed rounded-xl"
                >
                  <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-2" />
                  Tambah Complimentary
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
      )}
    </Drawer>
  );
}
