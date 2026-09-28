import { describe, expect, it } from "vitest";
import { createGuestbookEntrySchema, updateGuestbookEntrySchema } from "@/lib/validations/guestbook";

describe("guestbook package validation", () => {
  it("mengizinkan create guestbook Wedding tanpa paket", () => {
    const result = createGuestbookEntrySchema.safeParse({
      visitorName: "Tamu Tanpa Paket",
      eventCategory: "WEDDINGS",
      meetingLocation: "Kantor pusat",
      packageId: null,
    });

    expect(result.success).toBe(true);
  });

  it("mengizinkan edit guestbook untuk mengosongkan paket", () => {
    const result = updateGuestbookEntrySchema.safeParse({
      eventCategory: "WEDDINGS",
      packageId: null,
    });

    expect(result.success).toBe(true);
  });
});
