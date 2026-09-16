import { z } from "zod";

export const createBonusSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  price: z.number().int("Harga harus bilangan bulat").min(1, "Harga wajib diisi dan lebih dari 0"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateBonusSchema = createBonusSchema.partial().extend({
  name: z.string().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter").optional(),
});

export const bonusRowSchema = z.object({
  bonusId: z.string().nullable(),
  name: z.string().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  price: z.number().int("Harga harus bilangan bulat").min(1, "Harga wajib diisi dan lebih dari 0"),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter").nullable(),
  qty: z.number().int().min(1).default(1),
});

export type CreateBonusInput = z.infer<typeof createBonusSchema>;
export type UpdateBonusInput = z.infer<typeof updateBonusSchema>;
export type BonusRow = z.infer<typeof bonusRowSchema>;
