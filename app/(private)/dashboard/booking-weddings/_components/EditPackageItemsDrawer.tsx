"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  PackageItemsEditor,
  type PackageInternalItemDraft,
  type PackageVendorItemDraft,
  type PackageItemsTab,
} from "@/components/shared/PackageItemsEditor";
import { saveSnapInternalItems, saveSnapVendorItems } from "@/actions/snap-package-items";
import type { BookingDetail } from "@/lib/queries/bookings";

// ─── Content (no Drawer shell) ──────────────────────────────────────────────────
// Mirrors EditTakeoutContent: fetches the booking detail and renders the package
// items body WITHOUT a Sheet of its own, so it can be embedded inside the
// edit-booking single-Sheet continue flow. Saves BOTH internal and vendor items
// (two snap actions) before advancing.

interface PackageItemsBodyProps {
  bookingId: string;
  initialInternal: PackageInternalItemDraft[];
  initialVendor: PackageVendorItemDraft[];
  onClose: () => void;
  onPrevious?: () => void;
}

function PackageItemsBody({
  bookingId,
  initialInternal,
  initialVendor,
  onClose,
  onPrevious,
}: PackageItemsBodyProps): React.ReactElement {
  const qc = useQueryClient();
  // State seeds once from props. The parent renders this component with
  // key={bookingId}, so it remounts fresh whenever the booking changes — no reset
  // effect needed. Dropping the previous JSON.stringify-in-deps effect also stops a
  // background refetch (staleTime 30s) from clobbering the user's in-progress edits.
  const [internalItems, setInternalItems] = useState<PackageInternalItemDraft[]>(initialInternal);
  const [vendorItems, setVendorItems] = useState<PackageVendorItemDraft[]>(initialVendor);
  const [activeTab, setActiveTab] = useState<PackageItemsTab>("internal");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (internalItems.some((i) => !i.itemName.trim())) {
      toast.error("Nama item internal tidak boleh kosong.");
      setActiveTab("internal");
      return;
    }
    if (vendorItems.some((i) => !i.categoryName.trim() || !i.itemText.trim())) {
      toast.error("Kategori dan deskripsi item vendor tidak boleh kosong.");
      setActiveTab("vendor");
      return;
    }

    setSaving(true);
    // Internal items are frozen post client-signature; vendor items stay editable.
    // Save internal first — if the server rejects it (frozen), surface that and stop
    // before touching vendor items.
    const internalRes = await saveSnapInternalItems({
      bookingId,
      items: internalItems.map((i, idx) => ({
        itemName: i.itemName,
        itemDescription: i.itemDescription,
        sortOrder: idx,
      })),
    });
    if (!internalRes.success) {
      setSaving(false);
      toast.error(internalRes.error ?? "Gagal menyimpan item internal.");
      return;
    }

    const vendorRes = await saveSnapVendorItems({
      bookingId,
      items: vendorItems.map((i, idx) => ({
        categoryId: i.categoryId,
        categoryName: i.categoryName,
        itemText: i.itemText,
        sortOrder: idx,
      })),
    });
    setSaving(false);
    if (!vendorRes.success) {
      toast.error(vendorRes.error ?? "Gagal menyimpan item vendor.");
      return;
    }

    toast.success("Item paket berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1">
        <PackageItemsEditor
          internalItems={internalItems}
          vendorItems={vendorItems}
          onInternalChange={setInternalItems}
          onVendorChange={setVendorItems}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-4 border-t border-border bg-background pt-4 pb-1">
        <div className="flex gap-3">
          {onPrevious && (
            <Button type="button" variant="outline" onClick={onPrevious} className="flex-1 rounded-xl">
              Previous
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn("rounded-xl", onPrevious ? "flex-1" : "w-full")}
          >
            {saving ? "Menyimpan..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EditPackageItemsContent({
  active,
  bookingId,
  onClose,
  onPrevious,
}: {
  active: boolean;
  bookingId: string;
  onClose: () => void;
  onPrevious?: () => void;
}): React.ReactElement {
  const { data: bookingDetail, isLoading } = useQuery<BookingDetail>({
    queryKey: ["booking-detail", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking detail");
      return res.json() as Promise<BookingDetail>;
    },
    enabled: active && !!bookingId,
    staleTime: 30_000,
  });

  const initialInternal: PackageInternalItemDraft[] = (bookingDetail?.snapPackageInternalItems ?? []).map((i) => ({
    uid: i.id,
    itemName: i.itemName,
    itemDescription: i.itemDescription,
  }));
  const initialVendor: PackageVendorItemDraft[] = (bookingDetail?.snapPackageVendorItems ?? []).map((i) => ({
    uid: i.id,
    categoryId: i.categoryId ?? null,
    categoryName: i.categoryName,
    itemText: i.itemText,
  }));

  if (isLoading || !bookingDetail) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <PackageItemsBody
      key={bookingId}
      bookingId={bookingId}
      initialInternal={initialInternal}
      initialVendor={initialVendor}
      onClose={onClose}
      onPrevious={onPrevious}
    />
  );
}
