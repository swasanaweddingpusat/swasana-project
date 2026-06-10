export interface CategorySnap {
  id?: string;
  categoryName: string;
  basePrice: number;
  sortOrder: number;
  isShow: boolean;
  isTakeout: boolean;
  // Editable per-category takeout amount. 0 means "not set" → falls back to
  // basePrice (matches the UI convention `takeoutPrices[cat] ?? basePrice`).
  takeoutNominal?: number;
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
 * Compute the invariant "full price" of a package — the selling price BEFORE any
 * takeout deduction. Used at create/finalize time (no snapshot yet) to derive the
 * anchor that gets persisted as `snapPackagePricing.fullPrice`.
 *
 * Mirrors the UI's `baseSellingPrice` (booking-drawer.tsx): an explicit package
 * sellingPrice wins; otherwise it's ΣbasePrice + margin% over ALL categories.
 */
export function computeFullPrice(
  allCategories: { basePrice: number }[],
  margin: number,
  sellingPrice?: number,
): number {
  if (sellingPrice && sellingPrice > 0) return sellingPrice;
  const allBase = allCategories.reduce((sum, c) => sum + c.basePrice, 0);
  return allBase + Math.round(allBase * (margin / 100));
}

/**
 * Unified final-price model: `final = fullPrice − Σ(takeout per category)`.
 *
 * A category contributes a deduction only when visible AND takeout. The amount
 * is its `takeoutNominal` (partial takeout) or `basePrice` when nominal is unset.
 * This is the single source of truth used by create, finalize, edit booking, and
 * the edit-takeout drawer, so the number shown in the UI always equals the DB.
 */
export function calcFinalFromFullPrice(
  categories: { isShow: boolean; isTakeout: boolean; basePrice: number; takeoutNominal?: number }[],
  fullPrice: number,
): number {
  const totalTakeout = categories
    .filter((c) => c.isShow && c.isTakeout)
    .reduce((sum, c) => sum + (c.takeoutNominal && c.takeoutNominal > 0 ? c.takeoutNominal : c.basePrice), 0);
  return Math.max(0, fullPrice - totalTakeout);
}

/**
 * Distribute a target total across a list of terms, proportional to their
 * current amount. Falls back to even distribution when the current total is 0
 * (e.g. all terms were previously zeroed out by an overpayment). The rounding
 * remainder is absorbed into the last term so the sum stays exact.
 */
function distributeTarget(termsList: TermSnap[], target: number): AdjustedTerm[] {
  if (termsList.length === 0) return [];
  const totalCurrent = termsList.reduce((s, t) => s + t.amount, 0);

  let result: AdjustedTerm[];
  if (totalCurrent > 0) {
    result = termsList.map((t) => ({
      id: t.id,
      newAmount: Math.round((target * t.amount) / totalCurrent),
    }));
  } else {
    const each = Math.floor(target / termsList.length);
    result = termsList.map((t) => ({ id: t.id, newAmount: each }));
  }

  const assigned = result.reduce((s, t) => s + t.newAmount, 0);
  const remainder = target - assigned;
  if (remainder !== 0 && result.length > 0) {
    const last = result[result.length - 1];
    last.newAmount = Math.max(0, last.newAmount + remainder);
  }
  return result;
}

/**
 * Recompute term of payments so the editable pool sums to the new price.
 *
 * Set-to-target approach (idempotent + two-way). Works for both price
 * decreases (takeout enabled) AND increases (takeout disabled) — the pool is
 * always set to `newPrice - paidLockedTotal`, so toggling takeout on→off
 * restores the original amounts exactly.
 *
 * - Pool = unpaid/partial terms that are NOT acknowledged and NOT refund.
 *   Paid/acknowledged terms are immutable. Refund terms are ignored (the
 *   caller deletes & recreates them).
 * - DP protection: the term named "DP" is funded first (up to its original
 *   amount) so it never drops to 0 while there is still a target to cover.
 * - Overpayment (paidLockedTotal > newPrice) becomes a single refund term.
 */
export function adjustTermsForPriceChange(
  terms: TermSnap[],
  newPrice: number,
): { adjustedTerms: AdjustedTerm[]; refundTerm: RefundTerm | null } {
  const considered = terms.filter((t) => t.paymentStatus !== "refund");

  const pool = considered.filter(
    (t) =>
      (t.paymentStatus === "unpaid" || t.paymentStatus === "partial") &&
      t.ackStatus !== "acknowledged",
  );
  const immutable = considered.filter((t) => !pool.includes(t));
  const paidLockedTotal = immutable.reduce((s, t) => s + t.amount, 0);

  const targetTotalForPool = Math.max(0, newPrice - paidLockedTotal);
  const overpayment = Math.max(0, paidLockedTotal - newPrice);

  // Fund DP first so it stays > 0 while any target remains.
  // DP = index 1 of the input terms array (caller must pass terms sorted by sortOrder asc).
  // Index 0 = Booking Fee, Index 1 = DP. Guard: if fewer than 2 terms, no DP identified.
  const dpById = terms.length >= 2 ? terms[1].id : null;
  const dpTerm = dpById ? pool.find((t) => t.id === dpById) : null;
  let adjustedTerms: AdjustedTerm[];
  if (dpTerm) {
    const dpTarget = Math.min(dpTerm.amount, targetTotalForPool);
    const nonDpPool = pool.filter((t) => t !== dpTerm);
    adjustedTerms = [
      { id: dpTerm.id, newAmount: dpTarget },
      ...distributeTarget(nonDpPool, targetTotalForPool - dpTarget),
    ];
  } else {
    adjustedTerms = distributeTarget(pool, targetTotalForPool);
  }

  const refundTerm: RefundTerm | null =
    overpayment > 0
      ? { name: "Refund Takeout", amount: overpayment, paymentStatus: "refund" }
      : null;

  return { adjustedTerms, refundTerm };
}
