import { z } from "zod";

export const grantHolidayTokenSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  publicHolidayId: z.string().min(1, "Hari besar wajib dipilih"),
  note: z.string().max(500).optional(),
});

export const revokeHolidayTokenSchema = z.object({
  grantId: z.string().min(1),
});

export type GrantHolidayTokenInput = z.infer<typeof grantHolidayTokenSchema>;
export type RevokeHolidayTokenInput = z.infer<typeof revokeHolidayTokenSchema>;
