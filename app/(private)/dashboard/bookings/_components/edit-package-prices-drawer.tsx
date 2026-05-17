"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updatePackagePrices } from "@/actions/package-prices";

interface CategoryRow {
  id: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
}

interface EditPackagePricesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  initialCategories: CategoryRow[];
  margin: number;
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function calcDisplayPrice(
  categories: CategoryRow[],
  toggles: Record<string, boolean>,
  margin: number,
): number {
  const base = categories.reduce(
    (sum, c) => sum + (!c.isShow || !toggles[c.id] ? c.basePrice : 0),
    0,
  );
  return base + Math.round(base * (margin / 100));
}

export function EditPackagePricesDrawer({
  isOpen,
  onClose,
  bookingId,
  customerName,
  initialCategories,
  margin,
}: EditPackagePricesDrawerProps): React.ReactElement {
  const qc = useQueryClient();
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialCategories.map((c) => [c.id, c.isTakeout])),
  );
  const [loading, setLoading] = useState(false);

  const visibleCategories = initialCategories.filter((c) => c.isShow);
  const currentPrice = calcDisplayPrice(initialCategories, toggles, margin);
  const hasIncluded = initialCategories.some((c) => !toggles[c.id]);

  const handleSave = async () => {
    if (!hasIncluded) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }
    setLoading(true);
    const result = await updatePackagePrices({
      bookingId,
      categoryToggles: visibleCategories.map((c) => ({
        id: c.id,
        isTakeout: toggles[c.id] ?? false,
      })),
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan.");
      return;
    }
    toast.success("Package prices berhasil diupdate.");
    await qc.invalidateQueries({ queryKey: ["bookings"] });
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Package Prices — ${customerName}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-3 px-1">
          <p className="text-xs text-muted-foreground">
            Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga
            otomatis berkurang dan term of payments disesuaikan.
          </p>
          {visibleCategories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Tidak ada kategori harga untuk booking ini.
            </p>
          )}
          <div className="space-y-2">
            {visibleCategories.map((cat) => {
              const isTakeout = toggles[cat.id] ?? false;
              return (
                <div
                  key={cat.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">{cat.categoryName}</p>
                    <p className="text-xs text-muted-foreground">
                      Rp{fmtRp(cat.basePrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs",
                        isTakeout ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {isTakeout ? "Takeout" : "Included"}
                    </span>
                    <Switch
                      checked={isTakeout}
                      onCheckedChange={(v) =>
                        setToggles((prev) => ({ ...prev, [cat.id]: v }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg bg-muted/30 p-3 space-y-1 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Harga setelah takeout</span>
              <span className="font-semibold">Rp{fmtRp(currentPrice)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Margin {margin}%</span>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-background pt-4">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={loading || !hasIncluded}
          >
            {loading ? "Menyimpan..." : "Update Package Prices"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
