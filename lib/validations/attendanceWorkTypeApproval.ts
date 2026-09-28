import { z } from "zod";

export const approveWorkTypeSchema = z.object({
  attendanceId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export const rejectWorkTypeSchema = z.object({
  attendanceId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi").max(500),
});

export type ApproveWorkTypeInput = z.infer<typeof approveWorkTypeSchema>;
export type RejectWorkTypeInput = z.infer<typeof rejectWorkTypeSchema>;
