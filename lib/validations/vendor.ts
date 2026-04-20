import { z } from "zod";

export const createVendorCategorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateVendorCategorySchema = createVendorCategorySchema.partial();

export const paymentMethodSchema = z.object({
  bankName: z.string().min(1, "Nama bank wajib diisi"),
  bankAccountNumber: z.string().min(1, "No. rekening wajib diisi"),
  bankRecipient: z.string().min(1, "Nama pemilik wajib diisi"),
});

export const createVendorSchema = z.object({
  name: z.string().min(1, "Nama vendor wajib diisi"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  description: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  paymentMethods: z.array(paymentMethodSchema).optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export type CreateVendorCategoryInput = z.infer<typeof createVendorCategorySchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
