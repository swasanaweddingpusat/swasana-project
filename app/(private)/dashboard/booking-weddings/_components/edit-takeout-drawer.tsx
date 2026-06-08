"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { cn } from "@/lib/utils";
import { updateTakeoutWithTerms } from "@/actions/package-prices";
import { calcFinalFromFullPrice } from "@/lib/package-prices";
import { useQueryClient } from "@tanstack/react-query";
import { fmtRp, type FinanceCategoryRow, type FinanceTerm } from "./edit-finance-shared";
import { TakeoutTopStep, type TopStepResult } from "./takeout-top-step";

/* ─── Step 1: Takeout pricing (toggle + nominal per category) ──────────────── */

interface TakeoutStepProps {
  categories: FinanceCategoryRow[];
  fullPrice: number;
  toggles: Record<string, boolean>;
  setToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  takeoutNominals: Record<string, number>;
  setTakeoutNominals: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

function TakeoutStep({
  categories,
  fullPrice,
  toggles,
  setToggles,
  takeoutNominals,
  setTakeoutNominals,
}: TakeoutStepProps): React.ReactElement {
  const visibleCategories = categories.filter((c) => c.isShow);

  const currentPrice = calcFinalFromFullPrice(
    categories.map((c) => ({
      isShow: c.isShow,
      isTakeout: toggles[c.id] ?? false,
      basePrice: c.basePrice,
      takeoutNominal: takeoutNominals[c.id] ?? 0,
    })),
    fullPrice,
  );
  const totalTakeoutNominal = visibleCategories
    .filter((c) => toggles[c.id])
    .reduce((sum, c) => sum + (takeoutNominals[c.id] ?? c.basePrice), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky price summary */}
      <div className="sticky top-0 z-10 bg-background pb-2">
        <div className={cn("rounded-2xl", "border", "bg-card", "shadow-sm", "p-4")}>
          <p className="text-xs text-muted-foreground mb-1">Harga setelah takeout</p>
          <p className={cn("text-xl", "font-semibold", "font-heading", "text-foreground")}>
            Rp{fmtRp(currentPrice)}
          </p>
          {totalTakeoutNominal > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="line-through">Rp{fmtRp(fullPrice)}</span>
              <span className="ml-2 text-destructive font-medium">
                -Rp{fmtRp(totalTakeoutNominal)}
              </span>
            </p>
          )}
        </div>
      </div>

      <div>
        <p className={cn("text-sm", "font-medium", "text-foreground")}>Kategori Harga Package</p>
        <p className="text-xs text-muted-foreground mt-1">
          Tandai kategori sebagai takeout jika klien menyediakan sendiri. Harga otomatis berkurang.
        </p>
      </div>

      {visibleCategories.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Tidak ada kategori harga untuk booking ini.
        </p>
      )}

      <div className="space-y-2">
        {visibleCategories.map((cat) => {
          const isTakeout = toggles[cat.id] ?? false;
          const takeoutNominal = takeoutNominals[cat.id] ?? cat.basePrice;
          return (
            <div
              key={cat.id}
              className={cn(
                "rounded-xl",
                "border",
                "p-3",
                isTakeout && "border-destructive/30 bg-destructive/5",
              )}
            >
              <div className={cn("flex", "items-center", "justify-between")}>
                <div>
                  <p className={cn("text-sm font-medium", isTakeout && "line-through text-muted-foreground")}>
                    {cat.categoryName}
                  </p>
                  <p className={cn("text-xs text-muted-foreground", isTakeout && "line-through")}>
                    Rp{fmtRp(cat.basePrice)}
                  </p>
                </div>
                <div className={cn("flex", "items-center", "gap-2")}>
                  <span
                    className={cn(
                      "text-xs",
                      isTakeout ? "text-destructive font-medium" : "text-muted-foreground",
                    )}
                  >
                    Takeout
                  </span>
                  <Switch
                    checked={isTakeout}
                    onCheckedChange={(v) => {
                      setToggles((prev) => ({ ...prev, [cat.id]: v }));
                      if (v) {
                        setTakeoutNominals((prev) => ({
                          ...prev,
                          [cat.id]: prev[cat.id] ?? cat.basePrice,
                        }));
                      } else {
                        setTakeoutNominals((prev) => {
                          const next = { ...prev };
                          delete next[cat.id];
                          return next;
                        });
                      }
                    }}
                  />
                </div>
              </div>
              {isTakeout && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Nominal takeout</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      value={takeoutNominal ? fmtRp(takeoutNominal) : ""}
                      onChange={(e) => {
                        const num = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                        setTakeoutNominals((prev) => ({ ...prev, [cat.id]: num }));
                      }}
                      placeholder={`Rp${fmtRp(cat.basePrice)}`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── EditTakeoutDrawer (2-step wizard) ───────────────────────────────────── */

export interface EditTakeoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  customerName: string;
  initialCategories: FinanceCategoryRow[];
  initialTerms: FinanceTerm[];
  fullPrice: number;
}

export function EditTakeoutDrawer({
  isOpen,
  onClose,
  bookingId,
  customerName,
  initialCategories,
  initialTerms,
  fullPrice,
}: EditTakeoutDrawerProps): React.ReactElement {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  const [toggles, setToggles] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialCategories.map((c) => [c.id, c.isTakeout])),
  );
  const [takeoutNominals, setTakeoutNominals] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        initialCategories
          .filter((c) => c.isTakeout)
          .map((c) => [c.id, c.takeoutNominal > 0 ? c.takeoutNominal : c.basePrice]),
      ),
  );
  const [topResult, setTopResult] = useState<TopStepResult>({ overrides: [], balanced: true });

  const visibleCategories = initialCategories.filter((c) => c.isShow);
  // At least one visible category must remain included (not takeout).
  const hasIncluded = visibleCategories.some((c) => !toggles[c.id]);

  // Price after takeout — recomputed with the shared model (same as server).
  const newPrice = calcFinalFromFullPrice(
    initialCategories.map((c) => ({
      isShow: c.isShow,
      isTakeout: toggles[c.id] ?? false,
      basePrice: c.basePrice,
      takeoutNominal: takeoutNominals[c.id] ?? 0,
    })),
    fullPrice,
  );

  const handleNext = () => {
    if (!hasIncluded) {
      toast.error("Minimal satu kategori harus tetap included.");
      return;
    }
    setStep(2);
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  const handleSave = async () => {
    if (!topResult.balanced) {
      toast.error("Total cicilan belum sama dengan sisa tagihan. Sesuaikan dulu.");
      return;
    }
    setLoading(true);
    const result = await updateTakeoutWithTerms({
      bookingId,
      categoryToggles: visibleCategories.map((c) => ({
        id: c.id,
        isTakeout: toggles[c.id] ?? false,
        takeoutNominal: toggles[c.id] ? (takeoutNominals[c.id] ?? c.basePrice) : 0,
      })),
      termOverrides: topResult.overrides,
    });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan.");
      return;
    }
    toast.success("Takeout & term of payment berhasil diupdate.");
    await qc.invalidateQueries({ queryKey: ["bookings"] });
    handleClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={`Takeout — ${customerName}`}
      steps={step}
      totalSteps={2}
      onBack={step === 2 ? () => setStep(1) : undefined}
      backButtonLabel="Kembali ke takeout"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-1">
          {step === 1 ? (
            <TakeoutStep
              categories={initialCategories}
              fullPrice={fullPrice}
              toggles={toggles}
              setToggles={setToggles}
              takeoutNominals={takeoutNominals}
              setTakeoutNominals={setTakeoutNominals}
            />
          ) : (
            <TakeoutTopStep
              initialTerms={initialTerms}
              newPrice={newPrice}
              onChange={setTopResult}
            />
          )}
        </div>

        <div className="sticky bottom-0 bg-background pt-4">
          {step === 1 ? (
            <Button className="w-full" onClick={handleNext} disabled={!hasIncluded}>
              Lanjut → Atur Term of Payment
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={loading || !topResult.balanced}
            >
              {loading ? "Menyimpan..." : "Simpan Takeout & TOP"}
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
