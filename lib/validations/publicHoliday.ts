import { z } from "zod";

export const publicHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  name: z.string().min(1, "Nama wajib diisi").max(100),
});

export type PublicHolidayInput = z.infer<typeof publicHolidaySchema>;
