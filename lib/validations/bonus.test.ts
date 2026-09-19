import { describe, expect, it } from "vitest";
import { createBonusSchema, updateBonusSchema, bonusRowSchema } from "@/lib/validations/bonus";

describe("createBonusSchema", () => {
  it("accepts a valid bonus with positive price", () => {
    const r = createBonusSchema.safeParse({ name: "Free Photobooth", price: 1500000 });
    expect(r.success).toBe(true);
  });
  it("rejects price = 0 (mandatory > 0)", () => {
    const r = createBonusSchema.safeParse({ name: "X", price: 0 });
    expect(r.success).toBe(false);
  });
  it("rejects negative price", () => {
    expect(createBonusSchema.safeParse({ name: "X", price: -5 }).success).toBe(false);
  });
  it("rejects non-integer price", () => {
    expect(createBonusSchema.safeParse({ name: "X", price: 10.5 }).success).toBe(false);
  });
  it("rejects missing price", () => {
    expect(createBonusSchema.safeParse({ name: "X" }).success).toBe(false);
  });
  it("rejects empty name", () => {
    expect(createBonusSchema.safeParse({ name: "", price: 100 }).success).toBe(false);
  });
  it("has NO isShowPrice field (stripped/absent)", () => {
    const r = createBonusSchema.parse({ name: "X", price: 100, isShowPrice: true } as never);
    expect("isShowPrice" in r).toBe(false);
  });
});

describe("updateBonusSchema", () => {
  it("allows partial update of name only", () => {
    expect(updateBonusSchema.safeParse({ name: "New name" }).success).toBe(true);
  });
  it("still rejects price = 0 when price is provided", () => {
    expect(updateBonusSchema.safeParse({ price: 0 }).success).toBe(false);
  });
});

describe("bonusRowSchema", () => {
  it("accepts a selected bonus line with price > 0", () => {
    const r = bonusRowSchema.safeParse({ bonusId: "uuid", name: "X", price: 200, description: null, qty: 1 });
    expect(r.success).toBe(true);
  });
  it("rejects a bonus line with price 0", () => {
    expect(bonusRowSchema.safeParse({ bonusId: null, name: "X", price: 0, description: null, qty: 1 }).success).toBe(false);
  });
});
