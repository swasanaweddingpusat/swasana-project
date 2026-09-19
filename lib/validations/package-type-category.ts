import { z } from "zod";

export const packageTypeCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .max(10, "Kode maksimal 10 karakter")
    .transform((v) => v.toUpperCase()),
  isActive: z.boolean().default(true),
});

export type PackageTypeCategoryFormInput = z.infer<typeof packageTypeCategoryFormSchema>;
