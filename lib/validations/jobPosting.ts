import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1, "Judul lowongan wajib diisi"),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employmentType: z.enum(["permanent", "contract", "probation", "intern"]).optional(),
  location: z.string().optional(),
  salaryRangeMin: z.number().min(0).optional(),
  salaryRangeMax: z.number().min(0).optional(),
});

export const updateJobPostingSchema = createJobPostingSchema.partial();

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;
