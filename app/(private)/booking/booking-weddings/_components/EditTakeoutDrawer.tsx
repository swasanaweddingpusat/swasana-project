"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveSnapTakeout } from "@/actions/snap-package-items";
import { firstError, takeoutRowsSchema } from "@/lib/validations/booking-form";
import type { BookingDetail } from "@/lib/queries/bookings";

// ─── Types ────────────────────────────────────────────────────────────────────


interface TakeoutRow {
  categoryName: string;
  basePrice: number;
  isTakeout: boolean;
  takeoutNominal: number;
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

// ─── Content ─────────────────────────────────────────────────────────────────

interface TakeoutContentProps {
  bookingId: string;
  onClose: () => void;
  onPrevious?: () => void;
  initialRows: TakeoutRow[];
  fullPrice: number;
  /** Label for the save/continue button. Defaults to "Continue" (linear mode).
   *  Pass "Simpan" in free-mode so the user stays on the tab after saving. */
  saveLabel?: string;
}

function TakeoutContent({ bookingId, onClose, onPrevious, initialRows, fullPrice, saveLabel = "Continue" }: TakeoutContentProps): React.ReactElement {
  const qc = useQueryClient();
  const [rows, setRows] = useState<TakeoutRow[]>(initialRows);
  const [saving, setSaving] = useState(false);

  // Reset when parent data actually changes (drawer re-opened for same booking with fresh data)
  useEffect(() => {
    setRows(initialRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialRows)]);

  const totalTakeout = rows
    .filter((r) => r.isTakeout)
    .reduce((s, r) => s + r.takeoutNominal, 0);
  const priceAfterTakeout = Math.max(0, fullPrice - totalTakeout);

  const handleSave = async () => {
    // Guard: a category marked takeout must carry a nominal > 0.
    const takeoutErr = firstError(takeoutRowsSchema, rows);
    if (takeoutErr) {
      toast.error(takeoutErr);
      return;
    }
    setSaving(true);
    const result = await saveSnapTakeout({
      bookingId,
      items: rows.map((r) => ({
        categoryName: r.categoryName,
        isTakeout: r.isTakeout,
        takeoutNominal: r.isTakeout ? r.takeoutNominal : 0,
      })),
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan takeout.");
      return;
    }
    toast.success("Takeout berhasil diupdate");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking-detail", bookingId] });
    // Takeout now recomputes the stored price server-side — refresh the finance detail
    // so the TOP tab reads the new price (and its "Selisih") instead of a stale cache.
    qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sticky price summary */}
      <div className="sticky top-0 z-10 bg-background pb-2 px-1">
        <div className="rounded-2xl border bg-card shadow-sm p-4">
          <p className="text-xs text-muted-foreground mb-1">Harga setelah takeout</p>
          <p className="text-xl font-semibold font-heading text-foreground">Rp{fmtRp(priceAfterTakeout)}</p>
          {totalTakeout > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="line-through">Rp{fmtRp(fullPrice)}</span>
              <span className="ml-2 text-destructive font-medium">-Rp{fmtRp(totalTakeout)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto px-1 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Kategori Harga Package</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang.
          </p>
        </div>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Tidak ada kategori harga untuk variant ini.
          </p>
        )}
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.categoryName}
              className={cn(
                "rounded-xl border p-3",
                row.isTakeout && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-medium", row.isTakeout && "line-through text-muted-foreground")}>
                    {row.categoryName}
                  </p>
                  <p className={cn("text-xs text-muted-foreground", row.isTakeout && "line-through")}>
                    Rp{fmtRp(row.basePrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", row.isTakeout ? "text-destructive font-medium" : "text-muted-foreground")}>
                    Takeout
                  </span>
                  <Switch
                    checked={row.isTakeout}
                    onCheckedChange={(v) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.categoryName === row.categoryName
                            ? { ...r, isTakeout: v, takeoutNominal: v ? r.takeoutNominal || r.basePrice : 0 }
                            : r,
                        ),
                      )
                    }
                  />
                </div>
              </div>
              {row.isTakeout && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Nominal takeout</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      value={row.takeoutNominal ? fmtRp(row.takeoutNominal) : ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\D/g, "")) || 0;
                        setRows((prev) =>
                          prev.map((r) => r.categoryName === row.categoryName ? { ...r, takeoutNominal: num } : r),
                        );
                      }}
                      placeholder={`Rp${fmtRp(row.basePrice)}`}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-4 border-t border-border bg-background pt-4 pb-1">
        <div className="flex gap-3">
          {onPrevious && (
            <Button type="button" variant="outline" onClick={onPrevious} className="flex-1 rounded-xl">
              Previous
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={saving} className={cn("rounded-xl", onPrevious ? "flex-1" : "w-full")}>
            {saving ? "Menyimpan..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Content (no Drawer shell) ──────────────────────────────────────────────────
// Fetches the booking detail and renders the takeout body WITHOUT a Sheet of its
// own, so it can be embedded inside another drawer's single Sheet (the edit-booking
// continue flow) as well as wrapped by the standalone shell below.

export function EditTakeoutContent({
  active,
  bookingId,
  onClose,
  onPrevious,
  saveLabel,
}: {
  active: boolean;
  bookingId: string;
  onClose: () => void;
  onPrevious?: () => void;
  saveLabel?: string;
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

  const categoryPrices = bookingDetail?.snapPackageCategoryPrices ?? [];
  const visibleCategories = categoryPrices.filter((c) => c.isShow);

  // Compute fullPrice from snapPackagePricing.fullPrice
  const fullPrice = Number(bookingDetail?.snapPackagePricing?.fullPrice ?? 0);

  const initialRows: TakeoutRow[] = visibleCategories.map((c) => ({
    categoryName: c.categoryName,
    basePrice: Number(c.basePrice),
    isTakeout: c.isTakeout ?? false,
    takeoutNominal: Number(c.takeoutNominal ?? c.basePrice),
  }));

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TakeoutContent
      key={bookingId}
      bookingId={bookingId}
      onClose={onClose}
      onPrevious={onPrevious}
      initialRows={initialRows}
      fullPrice={fullPrice}
      saveLabel={saveLabel}
    />
  );
}

