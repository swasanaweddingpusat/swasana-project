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
  // New fields
  isWalkInInterview: z.boolean().optional().default(false),
  brandId: z.string().optional().nullable(),
  submissionDate: z.coerce.date().optional().nullable(),
  interviewDate: z.coerce.date().optional().nullable(),
  level: z.enum(["entry", "junior", "mid", "senior", "lead", "manager", "director"]).optional().nullable(),
  quota: z.number().int().min(1).optional().nullable(),
  interviewLocation: z.enum(["online", "offline", "hybrid"]).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  minEducation: z.string().optional().nullable(),
  minExperience: z.string().optional().nullable(),
  otherQualifications: z.string().optional().nullable(),
  jobDescriptions: z.array(z.string().min(1)).optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  approverId: z.string().optional().nullable(),
  submittedBySignature: z.string().optional().nullable(),
});

export const updateJobPostingSchema = createJobPostingSchema.partial();

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;
