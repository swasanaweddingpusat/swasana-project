import { z } from "zod";

const discountTypeSchema = z.enum(["PERCENTAGE", "NOMINAL"]);
const voucherTypeSchema = z.enum(["payment_discount", "cashback"]);

/**
 * Object dasar TANPA refinement. Refinement dipisah supaya `.partial()` (update)
 * bisa dipakai — Zod v4 melarang `.partial()` pada schema yang sudah `.superRefine()`.
 */
const promoBaseSchema = z.object({
  name: z
    .string()
    .min(1, "Nama program wajib diisi")
    .max(150, "Nama program maksimal 150 karakter"),
  isActive: z.boolean().default(true),
  discountType: discountTypeSchema,
  type: voucherTypeSchema.default("payment_discount"),
  discountValue: z
    .number()
    .int("Nilai potongan harus bilangan bulat")
    .positive("Nilai potongan harus > 0"),
  minTransaction: z
    .number()
    .int("Minimal transaksi harus bilangan bulat")
    .nonnegative("Minimal transaksi tidak boleh negatif")
    .nullable()
    .optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  eventEligibleStart: z.coerce.date().nullable().optional(),
  eventEligibleEnd: z.coerce.date().nullable().optional(),
  quota: z
    .number()
    .int("Quota harus bilangan bulat")
    .min(1, "Quota minimal 1")
    .nullable()
    .optional(),
  description: z.string().max(2000, "Deskripsi maksimal 2000 karakter").optional().nullable(),
});

/**
 * Cross-field checks. Semua field di-guard undefined supaya aman dipakai baik pada
 * create (full) maupun update (partial).
 */
function refinePromo(
  data: Partial<z.infer<typeof promoBaseSchema>>,
  ctx: z.RefinementCtx,
): void {
  // Percentage <= 100
  if (data.discountType === "PERCENTAGE" && data.discountValue !== undefined && data.discountValue > 100) {
    ctx.addIssue({
      code: "custom",
      message: "Persentase tidak boleh melebihi 100%",
      path: ["discountValue"],
    });
  }

  // periodEnd >= periodStart
  if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
    ctx.addIssue({
      code: "custom",
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
      path: ["periodEnd"],
    });
  }

  // eventEligibleEnd >= eventEligibleStart
  if (
    data.eventEligibleStart &&
    data.eventEligibleEnd &&
    data.eventEligibleEnd < data.eventEligibleStart
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Tanggal selesai event harus setelah tanggal mulai",
      path: ["eventEligibleEnd"],
    });
  }
}

export const createPromoSchema = promoBaseSchema.superRefine(refinePromo);

export const updatePromoSchema = promoBaseSchema
  .partial()
  .extend({
    name: z
      .string()
      .min(1, "Nama program wajib diisi")
      .max(150, "Nama program maksimal 150 karakter")
      .optional(),
  })
  .superRefine(refinePromo);

export type CreatePromoInput = z.infer<typeof createPromoSchema>;
export type UpdatePromoInput = z.infer<typeof updatePromoSchema>;
