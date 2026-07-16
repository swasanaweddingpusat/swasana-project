import { z } from "zod";

export const createPerformanceReviewSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  rating: z.number().min(0).max(5),
  strengths: z.string().optional(),
  comments: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"]).default("PENDING"),
});

export const updatePerformanceReviewSchema = createPerformanceReviewSchema
  .omit({ profileId: true })
  .partial();

export const createKpiSchema = z.object({
  name: z.string().min(1, "Nama KPI wajib diisi"),
  description: z.string().optional(),
  department: z.string().optional(),
  targetValue: z.number().min(0),
  achievedValue: z.number().min(0).default(0),
  unit: z.string().min(1, "Satuan wajib diisi"),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  progressPercentage: z.number().min(0).max(100).default(0),
});

export const updateKpiSchema = createKpiSchema.partial();

export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;
export type UpdatePerformanceReviewInput = z.infer<typeof updatePerformanceReviewSchema>;
export type CreateKpiInput = z.infer<typeof createKpiSchema>;
export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;
