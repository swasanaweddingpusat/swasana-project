import { z } from "zod";

export const clockInSchema = z.object({
  photoBase64: z.string().min(1, "Foto wajib disertakan"),
  lat: z.number({ error: "Koordinat latitude wajib ada" }),
  lng: z.number({ error: "Koordinat longitude wajib ada" }),
});

export const clockOutSchema = z.object({
  photoBase64: z.string().min(1, "Foto wajib disertakan"),
  lat: z.number({ error: "Koordinat latitude wajib ada" }),
  lng: z.number({ error: "Koordinat longitude wajib ada" }),
});

export const attendanceSettingsSchema = z.object({
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:MM"),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:MM"),
  lateToleranceMinutes: z.number().int().min(0).max(120),
  officeLatitude: z.number().min(-90).max(90),
  officeLongitude: z.number().min(-180).max(180),
  officeRadiusMeters: z.number().int().min(10).max(5000),
});

export const attendanceListQuerySchema = z.object({
  profileId: z.string().optional(),
  date: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
