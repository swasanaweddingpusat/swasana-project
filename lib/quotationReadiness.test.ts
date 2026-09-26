import { describe, expect, it } from "vitest";
import { getQuotationConversionReadinessError } from "@/lib/quotationReadiness";

const readyQuotation = {
  venueId: "venue-1",
  eventTypeId: "event-1",
  eventDate: "2026-10-01",
  packageSource: "meeting-package",
  packageId: "package-1",
  subtotal: 10_000_000,
  signingLocation: "Jakarta",
  signatureSales: "data:image/png;base64,abc",
  terms: [{ amount: 10_000_000, dueDate: "2026-09-01" }],
};

describe("getQuotationConversionReadinessError", () => {
  it("accepts a conversion-ready quotation", () => {
    expect(getQuotationConversionReadinessError(readyQuotation)).toBeNull();
  });

  it("rejects incomplete payment terms before conversion", () => {
    expect(
      getQuotationConversionReadinessError({
        ...readyQuotation,
        terms: [{ amount: 0, dueDate: null }],
      }),
    ).toBe("Semua TOP wajib memiliki nominal dan tanggal jatuh tempo sebelum konversi.");
  });

  it("requires a selected package for meeting-package quotations", () => {
    expect(
      getQuotationConversionReadinessError({ ...readyQuotation, packageId: null }),
    ).toBe("Meeting Package wajib dipilih sebelum konversi.");
  });
});
