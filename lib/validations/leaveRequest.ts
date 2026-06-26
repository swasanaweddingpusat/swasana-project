import { z } from "zod";

export const submitLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Jenis cuti wajib dipilih"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export const approveLeaveSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().optional(),
});

export const rejectLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

export const cancelLeaveSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>;
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>;
