import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1, "Judul lowongan wajib diisi"),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional().nullable(),
  location: z.string().optional().nullable(),
  salaryRangeMin: z.number().int().min(0).optional().nullable(),
  salaryRangeMax: z.number().int().min(0).optional().nullable(),
});

export const updateJobPostingSchema = createJobPostingSchema.partial();

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;
