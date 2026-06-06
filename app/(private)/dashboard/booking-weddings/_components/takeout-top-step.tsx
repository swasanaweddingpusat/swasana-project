"use client";

import React, { useMemo, useState } from "react";
import { LockKeyhole, CheckCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { adjustTermsForPriceChange } from "@/lib/package-prices";
import { fmtRp, type FinanceTerm } from "./edit-finance-shared";

/* ─── Takeout step 2: review & adjust Term of Payment ─────────────────────────
 * Given the price AFTER takeout (from step 1), preview the recomputed terms with
 * the SAME function the server uses (adjustTermsForPriceChange), then let the
 * user fine-tune the editable (unpaid/partial, non-acknowledged) terms. Paid /
 * acknowledged / refund terms are locked. The editable pool must always sum to
 * `newPrice − lockedTotal`; the Simpan button is disabled until the difference
 * is zero. */

export interface TopStepResult {
  /** Final amounts for the editable pool terms, keyed by term id. */
  overrides: { id: string; amount: number }[];
  balanced: boolean;
}

interface TakeoutTopStepProps {
  initialTerms: FinanceTerm[];
  /** Selling price after takeout (computed in step 1). */
  newPrice: number;
  /** Reports the current pool amounts + balance up to the parent for saving. */
  onChange: (result: TopStepResult) => void;
}

function isPoolTerm(t: FinanceTerm): boolean {
  return (
    (t.paymentStatus === "unpaid" || t.paymentStatus === "partial") &&
    t.ackStatus !== "acknowledged"
  );
}

export function TakeoutTopStep({
  initialTerms,
  newPrice,
  onChange,
}: TakeoutTopStepProps): React.ReactElement {
  const nonRefundTerms = useMemo(
    () => initialTerms.filter((t) => t.paymentStatus !== "refund"),
    [initialTerms],
  );

  const lockedTotal = useMemo(
    () =>
      nonRefundTerms
        .filter((t) => !isPoolTerm(t))
        .reduce((s, t) => s + Number(t.amount), 0),
    [nonRefundTerms],
  );
  const targetForPool = Math.max(0, newPrice - lockedTotal);
  const overpayment = Math.max(0, lockedTotal - newPrice);

  // Seed the pool amounts from the shared recompute so the preview matches the
  // server result exactly (DP funded first, rest distributed proportionally).
  const seededAmounts = useMemo(() => {
    const { adjustedTerms } = adjustTermsForPriceChange(
      nonRefundTerms.map((t) => ({
        id: t.id,
        name: t.name,
        amount: Number(t.amount),
        paymentStatus: t.paymentStatus,
        ackStatus: t.ackStatus,
      })),
      newPrice,
    );
    return new Map(adjustedTerms.map((t) => [t.id, t.newAmount]));
  }, [nonRefundTerms, newPrice]);

  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of nonRefundTerms) {
      if (isPoolTerm(t)) init[t.id] = seededAmounts.get(t.id) ?? Number(t.amount);
    }
    return init;
  });

  const poolTerms = nonRefundTerms.filter(isPoolTerm);
  const poolSum = poolTerms.reduce((s, t) => s + (amounts[t.id] ?? 0), 0);
  const difference = poolSum - targetForPool;
  const balanced = difference === 0;

  // Report to parent on every change (memo-free: cheap derive).
  React.useEffect(() => {
    onChange({
      overrides: poolTerms.map((t) => ({ id: t.id, amount: amounts[t.id] ?? 0 })),
      balanced,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts, balanced]);

  const handleAmountChange = (id: string, raw: string) => {
    const num = parseInt(raw.replace(/\D/g, ""), 10) || 0;
    setAmounts((prev) => ({ ...prev, [id]: num }));
  };

  /** Auto-balance: push the entire remaining difference onto the term `id`
   *  (clamped at 0). Lets the user fix the balance in one tap. */
  const absorbDifferenceInto = (id: string) => {
    setAmounts((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current - difference);
      return { ...prev, [id]: next };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className={cn("rounded-2xl", "border", "bg-card", "shadow-sm", "p-4")}>
        <p className="text-xs text-muted-foreground mb-1">Harga setelah takeout</p>
        <p className={cn("text-xl", "font-semibold", "font-heading", "text-foreground")}>
          Rp{fmtRp(newPrice)}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Term of Payment</span>
          <span className="font-medium text-foreground">Rp{fmtRp(poolSum + lockedTotal)}</span>
        </div>
        {!balanced && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-destructive font-medium">Selisih</span>
            <span className="text-destructive font-medium">
              {difference > 0 ? "+" : "-"}Rp{fmtRp(Math.abs(difference))}
            </span>
          </div>
        )}
        {overpayment > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Kelebihan bayar Rp{fmtRp(overpayment)} akan dibuat sebagai term refund.
          </p>
        )}
      </div>

      <div>
        <p className={cn("text-sm", "font-medium", "text-foreground")}>Term of Payment</p>
        <p className="text-xs text-muted-foreground mt-1">
          Booking fee &amp; DP dipertahankan, sisanya otomatis dihitung ulang. Kamu masih bisa
          adjust nominal cicilan yang belum dibayar.
        </p>
      </div>

      <div className="space-y-2">
        {nonRefundTerms.map((term) => {
          const editable = isPoolTerm(term);
          const isAcknowledged = term.ackStatus === "acknowledged";
          const isPaid = term.paymentStatus === "paid";
          const amount = editable ? (amounts[term.id] ?? 0) : Number(term.amount);
          return (
            <div
              key={term.id}
              className={cn(
                "rounded-xl",
                "border",
                "p-3",
                !editable && "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{term.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPaid ? "Sudah dibayar" : isAcknowledged ? "Acknowledged" : "Belum dibayar"}
                  </p>
                </div>
                {!editable && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
                    {isAcknowledged ? (
                      <CheckCircle weight="BoldDuotone" className="h-3 w-3" />
                    ) : (
                      <LockKeyhole weight="BoldDuotone" className="h-3 w-3" />
                    )}
                    Terkunci
                  </span>
                )}
              </div>

              {editable ? (
                <div className="mt-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      value={amount ? fmtRp(amount) : ""}
                      onChange={(e) => handleAmountChange(term.id, e.target.value)}
                      placeholder="Rp0"
                    />
                  </div>
                  {!balanced && (
                    <button
                      type="button"
                      onClick={() => absorbDifferenceInto(term.id)}
                      className="mt-1 text-xs text-[var(--brand-gold)] hover:underline"
                    >
                      Serap selisih ke term ini
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-foreground">Rp{fmtRp(amount)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
