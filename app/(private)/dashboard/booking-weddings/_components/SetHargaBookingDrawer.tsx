"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { DrawerFinanceBase } from "@/components/shared/DrawerFinanceBase";
import { useUpdateBookingCategoryPrices } from "@/hooks/use-packages";
import type { DrawerFinanceSavePayload } from "@/components/shared/DrawerFinanceBase";
import type { BookingDetail } from "@/lib/queries/bookings";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SetHargaBookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  packageName: string;
  pax: number;
  venueName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SetHargaBookingDrawer({
  isOpen,
  onClose,
  bookingId,
  customerName,
  packageName,
  pax,
  venueName,
}: SetHargaBookingDrawerProps): React.JSX.Element {
  const updateMutation = useUpdateBookingCategoryPrices();

  const { data: bookingDetail, isLoading } = useQuery<BookingDetail>({
    queryKey: ["booking-detail", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking detail");
      return res.json() as Promise<BookingDetail>;
    },
    enabled: isOpen && !!bookingId,
    staleTime: 0,
  });

  const categories = (bookingDetail?.snapPackageCategoryPrices ?? []).map((c) => ({
    categoryId: null as string | null,
    categoryName: c.categoryName,
    basePrice: Number(c.basePrice),
    sortOrder: c.sortOrder,
    isShow: c.isShow,
  }));

  const initialMargin = bookingDetail?.snapPackagePricing?.margin ?? 0;
  // fullPrice is the "harga jual" before takeout deductions — this is what
  // DrawerFinanceBase treats as initialSellingPrice (the selling price the user set).
  const initialSellingPrice = bookingDetail?.snapPackagePricing?.fullPrice ?? 0;

  const contextLabel = `${customerName} — ${packageName} — ${pax} pax`;

  async function handleSave(
    payload: DrawerFinanceSavePayload,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await updateMutation.mutateAsync({
      bookingId,
      categories: payload.categories.map((c) => ({
        categoryId: c.categoryId ?? undefined,
        categoryName: c.categoryName,
        basePrice: c.basePrice,
        sortOrder: c.sortOrder,
        isShow: c.isShow,
      })),
      margin: payload.margin,
      sellingPrice: payload.sellingPrice,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  if (isLoading && isOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-none">
        <div className="w-full sm:max-w-130 h-full bg-background shadow-lg pointer-events-auto p-6 space-y-4">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <DrawerFinanceBase
      isOpen={isOpen}
      onClose={onClose}
      categories={categories}
      contextLabel={contextLabel}
      venueName={venueName}
      onSave={handleSave}
      isSaving={updateMutation.isPending}
      initialMargin={initialMargin}
      initialSellingPrice={initialSellingPrice}
    />
  );
}
