"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PackageItemsEditor,
  type PackageInternalItemDraft,
  type PackageVendorItemDraft,
  type PackageItemsTab,
} from "@/components/shared/PackageItemsEditor";
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

// ─── Inner Content — mounts only after bookingDetail is available ─────────────
// State is initialized once from bookingDetail at mount time via useState lazy
// initializer. No effects needed: the parent's key prop ensures this component
// remounts fresh whenever the booking changes, so stale state is never an issue.

interface EditPackageContentProps {
  bookingDetail: BookingDetail;
  target: EditPackageTarget;
  onClose: () => void;
}

function EditPackageContent({ bookingDetail, target, onClose }: EditPackageContentProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<PackageItemsTab>("internal");

  // State initialized once at mount from bookingDetail — no effects required.
  const [internalItems, setInternalItems] = useState<PackageInternalItemDraft[]>(() =>
    (bookingDetail.snapPackageInternalItems ?? []).map((i) => ({
      uid: i.id,
      itemName: i.itemName,
      itemDescription: i.itemDescription,
    })),
  );
  const [vendorItems, setVendorItems] = useState<PackageVendorItemDraft[]>(() =>
    (bookingDetail.snapPackageVendorItems ?? []).map((i) => ({
      uid: i.id,
      categoryId: i.categoryId ?? null,
      categoryName: i.categoryName,
      itemText: i.itemText,
    })),
  );
  // ── Saving state ──────────────────────────────────────────────────────────
  const [savingInternal, setSavingInternal] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);

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

  const saveVendor = useCallback(async () => {
    const emptyItem = vendorItems.find((i) => !i.categoryName.trim() || !i.itemText.trim());
    if (emptyItem) { toast.error("Nama kategori dan item text tidak boleh kosong."); return; }
    setSavingVendor(true);
    const res = await saveSnapVendorItems({
      bookingId: target.bookingId,
      items: vendorItems.map((i, idx) => ({ categoryId: i.categoryId, categoryName: i.categoryName, itemText: i.itemText, sortOrder: idx })),
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

  const saveLabelMap: Record<PackageItemsTab, string> = {
    internal: savingInternal ? "Menyimpan..." : "Simpan Item Internal",
    vendor: savingVendor ? "Menyimpan..." : "Simpan Item Vendor",
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        <PackageItemsEditor
          internalItems={internalItems}
          vendorItems={vendorItems}
          onInternalChange={setInternalItems}
          onVendorChange={setVendorItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
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
