import { z } from "zod";

export const createTrainingProgramSchema = z.object({
  name: z.string().min(1, "Nama program wajib diisi"),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).default("SCHEDULED"),
  participantsCount: z.number().int().min(0).default(0),
  completionPercentage: z.number().int().min(0).max(100).default(0),
});
export const updateTrainingProgramSchema = createTrainingProgramSchema.partial();

export const createEmployeeDevelopmentSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  skill: z.string().min(1, "Skill wajib diisi"),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  startDate: z.coerce.date(),
  targetCompletionDate: z.coerce.date().optional(),
  progressPercentage: z.number().int().min(0).max(100).default(0),
  notes: z.string().optional(),
});
export const updateEmployeeDevelopmentSchema = createEmployeeDevelopmentSchema.omit({ profileId: true }).partial();

export const createEmployeeCertificationSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  certificationName: z.string().min(1, "Nama sertifikasi wajib diisi"),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "PENDING", "EXPIRED"]).default("ACTIVE"),
  notes: z.string().optional(),
});
export const updateEmployeeCertificationSchema = createEmployeeCertificationSchema.omit({ profileId: true }).partial();

export type CreateTrainingProgramInput = z.infer<typeof createTrainingProgramSchema>;
export type UpdateTrainingProgramInput = z.infer<typeof updateTrainingProgramSchema>;
export type CreateEmployeeDevelopmentInput = z.infer<typeof createEmployeeDevelopmentSchema>;
export type UpdateEmployeeDevelopmentInput = z.infer<typeof updateEmployeeDevelopmentSchema>;
export type CreateEmployeeCertificationInput = z.infer<typeof createEmployeeCertificationSchema>;
export type UpdateEmployeeCertificationInput = z.infer<typeof updateEmployeeCertificationSchema>;
