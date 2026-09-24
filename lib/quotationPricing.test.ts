import { describe, expect, it } from "vitest";
import { calculateQuotationTotals } from "@/lib/quotationPricing";

describe("calculateQuotationTotals", () => {
  it("includes package prices, regular items, and additionals", () => {
    expect(
      calculateQuotationTotals({
        prices: [{ total: 66_000_000 }],
        items: [{ total: 2_000_000 }],
        additionals: [{ total: 3_000_000 }],
        discount: 15_000_000,
      }),
    ).toEqual({ subtotal: 71_000_000, totalPrice: 56_000_000 });
  });

  it("never returns a negative total", () => {
    expect(
      calculateQuotationTotals({ prices: [{ total: 5_000_000 }], discount: 8_000_000 }),
    ).toEqual({ subtotal: 5_000_000, totalPrice: 0 });
  });
});
