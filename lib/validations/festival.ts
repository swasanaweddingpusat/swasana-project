import { z } from "zod";

const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const createFestivalSchema = z
  .object({
    name: z.string().min(1, "Nama wajib diisi").max(100),
    description: optionalTrimmed(1000, "Keterangan maksimal 1000 karakter").optional(),
    backgroundImageKey: optionalTrimmed(500, "Key gambar tidak valid").optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Tanggal mulai harus sebelum atau sama dengan tanggal akhir",
    path: ["endDate"],
  });

export type CreateFestivalInput = z.infer<typeof createFestivalSchema>;

export const updateFestivalSchema = createFestivalSchema;

export type UpdateFestivalInput = z.infer<typeof updateFestivalSchema>;
