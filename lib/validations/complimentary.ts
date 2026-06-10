import { z } from "zod";

export const createComplimentarySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  price: z.number().int().min(0, "Harga tidak boleh negatif").default(0),
  description: z.string().max(500, "Deskripsi maksimal 500 karakter").optional().nullable(),
  isShowPrice: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateComplimentarySchema = createComplimentarySchema.partial().extend({
  name: z.string().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter").optional(),
});

export type CreateComplimentaryInput = z.infer<typeof createComplimentarySchema>;
export type UpdateComplimentaryInput = z.infer<typeof updateComplimentarySchema>;
