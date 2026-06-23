import { z } from "zod";

export const createShiftOverrideSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  date: z.coerce.date(),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  workLocationId: z.string().optional(),
  reason: z.string().optional(),
});

export const updateShiftOverrideSchema = createShiftOverrideSchema.omit({ profileId: true }).partial();

export type CreateShiftOverrideInput = z.infer<typeof createShiftOverrideSchema>;
export type UpdateShiftOverrideInput = z.infer<typeof updateShiftOverrideSchema>;
