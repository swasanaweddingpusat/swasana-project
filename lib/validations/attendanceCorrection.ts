import { z } from "zod";

export const attendanceCorrectionTypeEnum = z.enum(["CLOCK_IN", "CLOCK_OUT", "BOTH"]);
export type AttendanceCorrectionTypeValue = z.infer<typeof attendanceCorrectionTypeEnum>;

export const submitAttendanceCorrectionSchema = z
  .object({
    date: z.coerce.date(),
    type: attendanceCorrectionTypeEnum,
    requestedClockInAt: z.coerce.date().optional(),
    requestedClockOutAt: z.coerce.date().optional(),
    workShiftId: z.string().optional(),
    workLocationId: z.string().optional(),
    workType: z.enum(["WFO", "WFH", "WFA"]).optional(),
    reason: z.string().min(1, "Alasan wajib diisi"),
    photoBase64: z.string().min(1, "Bukti wajib diupload"),
  })
  .superRefine((data, ctx) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (data.date > today) {
      ctx.addIssue({ code: "custom", message: "Tanggal tidak boleh di masa depan", path: ["date"] });
    }

    if (data.type === "CLOCK_IN" || data.type === "BOTH") {
      if (!data.requestedClockInAt) {
        ctx.addIssue({ code: "custom", message: "Jam clock-in wajib diisi", path: ["requestedClockInAt"] });
      }
      if (!data.workShiftId) {
        ctx.addIssue({ code: "custom", message: "Shift wajib dipilih", path: ["workShiftId"] });
      }
      if (!data.workType) {
        ctx.addIssue({ code: "custom", message: "Tipe kerja wajib dipilih", path: ["workType"] });
      }
      if (data.workType === "WFO" && !data.workLocationId) {
        ctx.addIssue({ code: "custom", message: "Lokasi kerja wajib dipilih", path: ["workLocationId"] });
      }
    }

    if (data.type === "CLOCK_OUT" || data.type === "BOTH") {
      if (!data.requestedClockOutAt) {
        ctx.addIssue({ code: "custom", message: "Jam clock-out wajib diisi", path: ["requestedClockOutAt"] });
      }
    }
  });

export const approveAttendanceCorrectionSchema = z.object({
  requestId: z.string().min(1),
  note: z.string().optional(),
});

export const rejectAttendanceCorrectionSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

export const cancelAttendanceCorrectionSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
});

export type SubmitAttendanceCorrectionInput = z.infer<typeof submitAttendanceCorrectionSchema>;
export type ApproveAttendanceCorrectionInput = z.infer<typeof approveAttendanceCorrectionSchema>;
export type RejectAttendanceCorrectionInput = z.infer<typeof rejectAttendanceCorrectionSchema>;
export type CancelAttendanceCorrectionInput = z.infer<typeof cancelAttendanceCorrectionSchema>;
