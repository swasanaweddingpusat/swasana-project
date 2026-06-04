export interface CategorySnap {
  id?: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
}

export interface TermSnap {
  id: string;
  name: string;
  amount: number;
  paymentStatus: string;
  ackStatus?: string | null;
}

export interface AdjustedTerm {
  id: string;
  newAmount: number;
}

export interface RefundTerm {
  name: string;
  amount: number;
  paymentStatus: "refund";
}

/**
 * Calculate final price from category snapshots + margin.
 * Only non-takeout categories contribute to baseTotal.
 * Hidden categories (isShow = false) are never takeout, so always included.
 * If sellingPrice is provided and no takeouts exist, returns sellingPrice exactly.
 */
export function calcFinalPrice(categories: CategorySnap[], margin: number, sellingPrice?: number): number {
  const hasTakeout = categories.some((c) => c.isTakeout);
  if (!hasTakeout && sellingPrice && sellingPrice > 0) return sellingPrice;
  const baseTotal = categories
    .filter((c) => !c.isTakeout)
    .reduce((sum, c) => sum + c.basePrice, 0);
  return baseTotal + Math.round(baseTotal * (margin / 100));
}

/**
 * Adjust term of payments when price decreases.
 *
 * Case 1: totalUnpaid >= reduction
 *   Distribute reduction proportionally across unpaid/partial terms.
 *
 * Case 2: totalUnpaid < reduction (overpayment)
 *   Zero out all unpaid/partial terms, insert a refund term for the remainder.
 *
 * Returns { adjustedTerms, refundTerm } where refundTerm is null in Case 1.
 */
export function adjustTermsForPriceReduction(
  terms: TermSnap[],
  oldPrice: number,
  newPrice: number,
): { adjustedTerms: AdjustedTerm[]; refundTerm: RefundTerm | null } {
  const reduction = oldPrice - newPrice;
  if (reduction <= 0) return { adjustedTerms: [], refundTerm: null };

  // Terms that are paid OR acknowledged by finance are immutable — skip from reduction pool
  const unpaidTerms = terms.filter(
    (t) =>
      (t.paymentStatus === "unpaid" || t.paymentStatus === "partial") &&
      t.ackStatus !== "acknowledged",
  );
  const totalUnpaid = unpaidTerms.reduce((s, t) => s + t.amount, 0);

  if (totalUnpaid >= reduction) {
    // Case 1: proportional reduction — distribute across unpaid terms, then
    // absorb the rounding remainder into the last term so the total stays exact.
    const adjustedTerms: AdjustedTerm[] = unpaidTerms.map((t) => ({
      id: t.id,
      newAmount: t.amount - Math.round((reduction * t.amount) / totalUnpaid),
    }));
    // Fix rounding drift: the sum of individual rounds may differ from `reduction`
    // by a few rupiah. Absorb the remainder into the last term.
    const totalReduced = unpaidTerms.reduce((s, t) => s + t.amount, 0) -
      adjustedTerms.reduce((s, t) => s + t.newAmount, 0);
    const remainder = reduction - totalReduced;
    if (remainder !== 0 && adjustedTerms.length > 0) {
      const last = adjustedTerms[adjustedTerms.length - 1];
      last.newAmount = Math.max(0, last.newAmount - remainder);
    }
    return { adjustedTerms, refundTerm: null };
  } else {
    // Case 2: zero out all unpaid + create refund term
    const adjustedTerms: AdjustedTerm[] = unpaidTerms.map((t) => ({
      id: t.id,
      newAmount: 0,
    }));
    const overpayment = reduction - totalUnpaid;
    const refundTerm: RefundTerm = {
      name: "Refund Takeout",
      amount: overpayment,
      paymentStatus: "refund",
    };
    return { adjustedTerms, refundTerm };
  }
}
