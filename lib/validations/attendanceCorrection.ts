import { z } from "zod";

export const submitAttendanceCorrectionSchema = z
  .object({
    date: z.coerce.date(),
    requestedClockInAt: z.coerce.date().optional(),
    requestedClockOutAt: z.coerce.date().optional(),
    reason: z.string().min(1, "Alasan koreksi wajib diisi"),
    evidenceBase64: z
      .string()
      .regex(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/, "Format bukti tidak valid")
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.requestedClockInAt && !val.requestedClockOutAt) {
      ctx.addIssue({
        path: ["requestedClockInAt"],
        code: z.ZodIssueCode.custom,
        message: "Isi minimal salah satu koreksi clock-in atau clock-out",
      });
    }
  });

export const approveCorrectionSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().optional(),
});

export const rejectCorrectionSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

export const cancelCorrectionSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export type SubmitAttendanceCorrectionInput = z.infer<typeof submitAttendanceCorrectionSchema>;
export type ApproveCorrectionInput = z.infer<typeof approveCorrectionSchema>;
export type RejectCorrectionInput = z.infer<typeof rejectCorrectionSchema>;
export type CancelCorrectionInput = z.infer<typeof cancelCorrectionSchema>;
