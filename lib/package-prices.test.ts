import { describe, it, expect } from "vitest";
import { calcFinalFromFullPrice, adjustTermsForPriceChange } from "@/lib/package-prices";

describe("harness smoke", () => {
  it("calcFinalFromFullPrice deducts a visible takeout category", () => {
    const price = calcFinalFromFullPrice(
      [
        { isShow: true, isTakeout: false, basePrice: 100, takeoutNominal: 0 },
        { isShow: true, isTakeout: true, basePrice: 30, takeoutNominal: 0 },
      ],
      130,
    );
    expect(price).toBe(100);
  });
});

describe("adjustTermsForPriceChange — floor model", () => {
  it("locks a partially-paid term at its PAID amount, not its full nominal", () => {
    // BF fully paid (10), DP paid 30 of 60, Pelunasan unpaid 30. Price drops 100 → 70.
    const terms = [
      { id: "bf", name: "Booking Fee", amount: 10, paid: 10 },
      { id: "dp", name: "DP", amount: 60, paid: 30 },
      { id: "pl", name: "Pelunasan", amount: 30, paid: 0 },
    ];
    const { adjustedTerms, scheduleTotal, overpay } = adjustTermsForPriceChange(terms, 70);
    const byId = Object.fromEntries(adjustedTerms.map((t) => [t.id, t.newAmount]));

    expect(scheduleTotal).toBe(70);
    expect(overpay).toBe(0);
    // BF stays at its floor (fully paid).
    expect(byId.bf).toBe(10);
    // DP never drops below the 30 already received.
    expect(byId.dp).toBeGreaterThanOrEqual(30);
    // Everything reconciles to the new price.
    expect(adjustedTerms.reduce((s, t) => s + t.newAmount, 0)).toBe(70);
  });

  it("surfaces overpayment when the floor total exceeds the new price", () => {
    // BF 10 paid, DP 60 paid — 70 locked. Price drops to 50.
    const terms = [
      { id: "bf", name: "Booking Fee", amount: 10, paid: 10 },
      { id: "dp", name: "DP", amount: 60, paid: 60 },
      { id: "pl", name: "Pelunasan", amount: 30, paid: 0 },
    ];
    const { adjustedTerms, scheduleTotal, overpay } = adjustTermsForPriceChange(terms, 50);
    const total = adjustedTerms.reduce((s, t) => s + t.newAmount, 0);

    expect(overpay).toBe(20); // 70 locked − 50 owed
    expect(scheduleTotal).toBe(70); // schedule can't sink below the floor
    expect(total).toBe(70);
  });

  it("is two-way: a fully-unpaid schedule scales back up when takeout is removed", () => {
    const terms = [
      { id: "bf", name: "Booking Fee", amount: 10, paid: 0 },
      { id: "dp", name: "DP", amount: 40, paid: 0 },
      { id: "pl", name: "Pelunasan", amount: 20, paid: 0 },
    ];
    const down = adjustTermsForPriceChange(terms, 35).adjustedTerms;
    expect(down.reduce((s, t) => s + t.newAmount, 0)).toBe(35);
    const back = adjustTermsForPriceChange(terms, 70).adjustedTerms;
    expect(back.reduce((s, t) => s + t.newAmount, 0)).toBe(70);
  });

  it("keeps DP funded (index 1) rather than collapsing it to zero on a big drop", () => {
    const terms = [
      { id: "bf", name: "Booking Fee", amount: 10, paid: 0 },
      { id: "dp", name: "DP", amount: 60, paid: 0 },
      { id: "pl", name: "Pelunasan", amount: 30, paid: 0 },
    ];
    const { adjustedTerms } = adjustTermsForPriceChange(terms, 20);
    const byId = Object.fromEntries(adjustedTerms.map((t) => [t.id, t.newAmount]));
    expect(byId.dp).toBeGreaterThan(0);
    expect(adjustedTerms.reduce((s, t) => s + t.newAmount, 0)).toBe(20);
  });

  it("conserves Σ when the DP term is fully paid and rounding drift is negative", () => {
    // DP (index 1) fully paid 60/60 → weight 0, and it is order[0] for drift. The
    // other three terms are unpaid weight-10s. Price 62 → headroom 2 spread over
    // three equal terms rounds to 3 assigned → drift −1. The overshoot must come
    // back off a term that is ABOVE its floor, not be swallowed by the paid DP.
    const terms = [
      { id: "bf", name: "Booking Fee", amount: 10, paid: 0 },
      { id: "dp", name: "DP", amount: 60, paid: 60 },
      { id: "a", name: "A", amount: 10, paid: 0 },
      { id: "b", name: "B", amount: 10, paid: 0 },
    ];
    const { adjustedTerms, scheduleTotal } = adjustTermsForPriceChange(terms, 62);
    const byId = Object.fromEntries(adjustedTerms.map((t) => [t.id, t.newAmount]));
    expect(scheduleTotal).toBe(62);
    expect(byId.dp).toBe(60); // fully-paid term is never bumped off its floor
    expect(adjustedTerms.reduce((s, t) => s + t.newAmount, 0)).toBe(62); // Σ invariant holds
  });
});
