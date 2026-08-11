import { describe, it, expect } from "vitest";
import { fmtRp, terbilang, fmtRpTerbilang, stripHtml, decodeEntities } from "./pdfHelpers";

describe("fmtRp", () => {
  it("returns empty string for null/undefined", () => {
    expect(fmtRp(null)).toBe("");
    expect(fmtRp(undefined)).toBe("");
  });
  it("formats number with id-ID thousands separators", () => {
    expect(fmtRp(5000000)).toBe("Rp5.000.000");
    expect(fmtRp(0)).toBe("Rp0");
  });
  it("accepts bigint", () => {
    expect(fmtRp(BigInt(10000000))).toBe("Rp10.000.000");
  });
});

describe("terbilang", () => {
  it("handles small numbers", () => {
    expect(terbilang(0)).toBe("");
    expect(terbilang(1)).toBe("Satu");
    expect(terbilang(11)).toBe("Sebelas");
    expect(terbilang(19)).toBe("Sembilan Belas");
  });
  it("handles hundreds and thousands", () => {
    expect(terbilang(100)).toBe("Seratus");
    expect(terbilang(1000)).toBe("Seribu");
    expect(terbilang(2500)).toBe("Dua Ribu Lima Ratus");
  });
  it("handles millions", () => {
    expect(terbilang(5000000)).toBe("Lima Juta");
  });
});

describe("fmtRpTerbilang", () => {
  it("combines rupiah and words", () => {
    expect(fmtRpTerbilang(5000000)).toBe("Rp 5.000.000,-  (Lima Juta Rupiah)");
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities, trims", () => {
    expect(stripHtml("  <p>Hello &amp; World</p>  ")).toBe("Hello & World");
    expect(stripHtml("<b>A</b>&lt;b&gt;")).toBe("A<b>");
  });
});

describe("decodeEntities", () => {
  it("decodes entities without stripping tags or trimming", () => {
    expect(decodeEntities("  <b>A</b> &amp; B ")).toBe("  <b>A</b> & B ");
    expect(decodeEntities("&nbsp;x")).toBe(" x");
  });
});
