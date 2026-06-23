import { z } from "zod";

export const createWorkAssignmentSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  workLocationId: z.string().min(1, "Lokasi wajib dipilih"),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  isDefault: z.boolean().default(false),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const updateWorkAssignmentSchema = createWorkAssignmentSchema.omit({ profileId: true }).partial();

export const bulkCreateWorkAssignmentSchema = z.object({
  profileIds: z.array(z.string()).min(1, "Pilih minimal satu karyawan"),
  workLocationId: z.string().min(1, "Lokasi wajib dipilih"),
  workShiftId: z.string().min(1, "Shift wajib dipilih"),
  isDefault: z.boolean().default(false),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export type CreateWorkAssignmentInput = z.infer<typeof createWorkAssignmentSchema>;
export type UpdateWorkAssignmentInput = z.infer<typeof updateWorkAssignmentSchema>;
export type BulkCreateWorkAssignmentInput = z.infer<typeof bulkCreateWorkAssignmentSchema>;
