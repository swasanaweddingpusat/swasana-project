import { z } from "zod";

// ─── Client-side field validators for the booking drawers ─────────────────────
//
// Single source of truth for per-field validation shared by the create drawer
// (booking-drawer.tsx) and the edit drawer (useEditBookingForm.ts). Mirrors the
// server rules in lib/validations/booking.ts + customer.ts so the client shows the
// same messages the server would reject with.
//
// Email/NIK are OPTIONAL: blank is valid, but must be well-formed when filled.

const emailField = (lbl: string) =>
  z.string().email(`Email ${lbl} tidak valid`).or(z.literal(""));

const nikField = (lbl: string) =>
  z
    .string()
    .length(16, `NIK ${lbl} harus 16 digit`)
    .regex(/^\d+$/, `NIK ${lbl} hanya angka`)
    .or(z.literal(""));

export const bookingFieldSchemas = {
  // Step 1 — client info
  customerName: z.string().trim().min(1, "Nama customer wajib diisi"),
  emailCpp: emailField("CPP"),
  emailCpw: emailField("CPW"),
  nikCpp: nikField("CPP"),
  nikCpw: nikField("CPW"),
  // Step 2 — venue & event
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Paket wajib dipilih"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  weddingSession: z.string().min(1, "Sesi event wajib dipilih"),
  weddingType: z.string().min(1, "Tipe event wajib dipilih"),
  // Signature step
  signingLocation: z.string().trim().min(1, "Lokasi TTD wajib diisi"),
} as const;

export type BookingFieldKey = keyof typeof bookingFieldSchemas;

// ─── Sub-step row schemas (steps 3, 4 + complimentary) ────────────────────────
//
// The later steps edit lists of rows rather than flat fields. These array
// schemas mirror the server rules in actions/snap-package-items.ts so the client
// blocks the same bad rows the server would reject, with a clear first message.

/** Step 3 — Item Paket (internal): each item needs a non-empty name. */
export const packageInternalItemsSchema = z.array(
  z.object({ itemName: z.string().trim().min(1, "Nama item internal wajib diisi") }),
);

/** Step 3 — Item Paket (vendor): each row needs a category and description. */
export const packageVendorItemsSchema = z.array(
  z.object({
    categoryName: z.string().trim().min(1, "Kategori item vendor wajib diisi"),
    itemText: z.string().trim().min(1, "Deskripsi item vendor wajib diisi"),
  }),
);

/** Step 4 — Takeout: nominal must be > 0 whenever a category is marked takeout. */
export const takeoutRowsSchema = z.array(
  z
    .object({ isTakeout: z.boolean(), takeoutNominal: z.number() })
    .refine((r) => !r.isTakeout || r.takeoutNominal > 0, {
      message: "Nominal takeout harus lebih dari 0",
      path: ["takeoutNominal"],
    }),
);

/** Complimentary rows (embedded in step 2): name required, price/qty sane. */
export const complimentaryRowsSchema = z.array(
  z.object({
    name: z.string().trim().min(1, "Nama complimentary wajib diisi"),
    price: z.number().min(0, "Harga complimentary tidak boleh negatif"),
    qty: z.number().int().min(1, "Qty complimentary minimal 1"),
  }),
);

/** Returns the first Zod error message for a value, or null when it passes. */
export function firstError(schema: z.ZodType, value: unknown): string | null {
  const r = schema.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Tidak valid");
}

/** Convenience: validate a named booking field, returning its error or null. */
export function validateBookingField(field: BookingFieldKey, value: unknown): string | null {
  return firstError(bookingFieldSchemas[field], value);
}
