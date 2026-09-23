import { describe, expect, it } from "vitest";
import {
  createQuotationSchema,
  updateQuotationSchema,
} from "@/lib/validations/quotation";

const validQuotation = {
  clientName: "PT Nusantara",
  salesId: "sales-1",
  venueId: "venue-1",
  eventTypeId: "event-1",
  packageSource: "meeting-package" as const,
  packageId: "package-1",
  packageName: "Halfday 6 Hours",
  pax: 100,
  eventDate: "2026-10-01",
  items: [{
    title: "Ballroom Facilities",
    qty: 0,
    price: 0,
    total: 0,
    manualTotal: false,
    sortOrder: 0,
  }],
  additionals: [],
  prices: [{
    name: "Meeting Package",
    priceType: "QTY" as const,
    qty: 100,
    price: 660_000,
    total: 66_000_000,
    sortOrder: 0,
  }],
  complimentaries: [],
  bonuses: [],
  discount: 0,
  terms: [{
    name: "Down Payment",
    amount: 10_000_000,
    dueDate: "2026-09-01",
    sortOrder: 0,
  }],
  taxDeposits: [],
  signingLocation: "Jakarta",
  signatureSales: "data:image/png;base64,abc",
};

describe("quotation validation", () => {
  it("accepts a complete meeting-package quotation", () => {
    expect(createQuotationSchema.safeParse(validQuotation).success).toBe(true);
  });

  it("rejects a meeting package without package pricing", () => {
    const result = createQuotationSchema.safeParse({
      ...validQuotation,
      packageId: null,
      prices: [],
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected validation to fail");
    expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
      expect.arrayContaining(["packageId", "prices"]),
    );
  });

  it("keeps status-only updates truly partial", () => {
    expect(updateQuotationSchema.parse({ id: "quotation-1", status: "sent" })).toEqual({
      id: "quotation-1",
      status: "sent",
    });
  });
});
