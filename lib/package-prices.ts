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
  /** Σ alokasi Ledger cash-in ter-ack (pengganti paymentStatus/ackStatus — Fase 5). */
  paid: number;
}

export interface AdjustedTerm {
  id: string;
  newAmount: number;
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
 * Recompute term amounts so the schedule reconciles to a new price, honouring a
 * per-term *floor*: money already received into a term can never be un-scheduled.
 *
 * - floor(t) = min(max(paid, 0), amount) — cash locked into that term, capped at
 *   its nominal (excess over the nominal is overpayment, not schedule money).
 * - scheduleTotal = max(newPrice, Σfloor). The schedule never sinks below the
 *   floor; when the new price does, the difference is `overpay` (→ CreditBalance).
 * - Headroom above the floors is distributed proportional to each term's
 *   adjustable weight (amount − floor). Rounding drift lands on the DP (index 1),
 *   never below its floor. Fully-paid terms (weight 0) stay put.
 *
 * Two-way: removing takeout raises newPrice, headroom grows, unpaid terms scale
 * back up — toggling takeout on→off restores the original schedule.
 */
export function adjustTermsForPriceChange(
  terms: TermSnap[],
  newPrice: number,
): { adjustedTerms: AdjustedTerm[]; scheduleTotal: number; overpay: number } {
  const floorOf = (t: TermSnap): number => Math.min(Math.max(t.paid, 0), t.amount);
  const floorTotal = terms.reduce((s, t) => s + floorOf(t), 0);

  const scheduleTotal = Math.max(newPrice, floorTotal);
  const overpay = Math.max(0, floorTotal - newPrice);
  const headroom = scheduleTotal - floorTotal; // === max(0, newPrice − floorTotal)

  if (terms.length === 0) return { adjustedTerms: [], scheduleTotal, overpay };

  // Start every term at its floor, then hand out headroom by adjustable weight.
  const result = new Map<string, number>(terms.map((t) => [t.id, floorOf(t)]));
  const weightOf = (t: TermSnap): number => Math.max(0, t.amount - floorOf(t));
  const weightTotal = terms.reduce((s, t) => s + weightOf(t), 0);
  const termById = new Map<string, TermSnap>(terms.map((t) => [t.id, t]));

  // DP = index 1 (0 = Booking Fee). It absorbs the rounding remainder.
  const dpId = terms.length >= 2 ? terms[1].id : null;
  const order = dpId
    ? [dpId, ...terms.filter((t) => t.id !== dpId).map((t) => t.id)]
    : terms.map((t) => t.id);

  if (headroom > 0) {
    if (weightTotal > 0) {
      const weightById = new Map<string, number>(terms.map((t) => [t.id, weightOf(t)]));
      let assigned = 0;
      for (const id of order) {
        const give = Math.round((headroom * (weightById.get(id) ?? 0)) / weightTotal);
        result.set(id, (result.get(id) ?? 0) + give);
        assigned += give;
      }
      // Spread the rounding remainder DP-first, but only where a term can absorb
      // it without breaking its floor: positive drift lands on an adjustable term
      // (weight > 0), negative drift only comes off a term above its floor. This
      // keeps Σ newAmount === scheduleTotal even when DP is fully paid. |drift| < n.
      let drift = headroom - assigned;
      if (drift !== 0) {
        const step = drift > 0 ? 1 : -1;
        const canAbsorb = (id: string): boolean => {
          const t = termById.get(id);
          if (!t) return false;
          return step > 0 ? weightOf(t) > 0 : (result.get(id) ?? 0) > floorOf(t);
        };
        for (const id of order) {
          if (drift === 0) break;
          while (drift !== 0 && canAbsorb(id)) {
            result.set(id, (result.get(id) ?? 0) + step);
            drift -= step;
          }
        }
      }
    } else {
      // No adjustable weight (all terms fully paid). Park the headroom on the DP/first.
      result.set(order[0], (result.get(order[0]) ?? 0) + headroom);
    }
  }

  return {
    adjustedTerms: terms.map((t) => ({ id: t.id, newAmount: result.get(t.id) ?? floorOf(t) })),
    scheduleTotal,
    overpay,
  };
}
