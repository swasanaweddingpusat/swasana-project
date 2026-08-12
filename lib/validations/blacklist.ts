import { z } from "zod";

export const createBlacklistEntrySchema = z.object({
  fullName: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  reason: z.string().min(1, "Alasan wajib diisi"),
});

export type CreateBlacklistEntryInput = z.infer<typeof createBlacklistEntrySchema>;
