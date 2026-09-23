import { describe, expect, it } from "vitest";
import { saveMicePackageSchema } from "@/lib/validations/package";

const validPackage = {
  packageName: "Meeting Package",
  available: true,
  items: [{ itemName: "Meeting room", itemDescription: "Main ballroom" }],
  taxDeposits: [],
  prices: [{
    name: "Room rental",
    description: null,
    priceType: "NOMINAL" as const,
    qty: null,
    price: null,
    total: 5_000_000,
  }],
  complimentaries: [],
  bonuses: [],
};

describe("saveMicePackageSchema", () => {
  it("accepts a package with at least one facility item and one price", () => {
    expect(saveMicePackageSchema.safeParse(validPackage).success).toBe(true);
  });

  it("rejects a package without facility items so it cannot disappear from the quotation picker", () => {
    const result = saveMicePackageSchema.safeParse({ ...validPackage, items: [] });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected validation to fail");
    expect(result.error.issues[0]?.message).toBe("Minimal 1 item fasilitas");
  });
});
