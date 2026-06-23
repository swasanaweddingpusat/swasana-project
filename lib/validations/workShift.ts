import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const createWorkShiftSchema = z.object({
  name: z.string().min(1, "Nama shift wajib diisi"),
  startTime: z.string().regex(timeRegex, "Format jam harus HH:MM"),
  endTime: z.string().regex(timeRegex, "Format jam harus HH:MM"),
  lateToleranceMinutes: z.number().int().min(0).max(120).default(15),
  isOvernight: z.boolean().default(false),
});

export const updateWorkShiftSchema = createWorkShiftSchema.partial();

export type CreateWorkShiftInput = z.infer<typeof createWorkShiftSchema>;
export type UpdateWorkShiftInput = z.infer<typeof updateWorkShiftSchema>;
