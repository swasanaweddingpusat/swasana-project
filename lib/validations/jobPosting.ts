import { z } from "zod";

const jobPostingBase = z.object({
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
  companyName: z.string().optional().nullable(),
  submissionDate: z.coerce.date().optional().nullable(),
  interviewDate: z.coerce.date().optional().nullable(),
  level: z.enum(["entry", "junior", "mid", "senior", "lead", "manager", "director"]).optional().nullable(),
  quota: z.number().int().min(1).optional().nullable(),
  interviewLocation: z.enum(["online", "offline", "hybrid"]).optional().nullable(),
  interviewLink: z.string().optional().nullable(),
  interviewVenueId: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  minEducation: z.string().optional().nullable(),
  minExperience: z.string().optional().nullable(),
  otherQualifications: z.string().optional().nullable(),
  jobDescriptions: z.array(z.string().min(1)).optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  approverId: z.string().optional().nullable(),
  approver2Id: z.string().optional().nullable(),
  submittedBySignature: z.string().optional().nullable(),
});

export const createJobPostingSchema = jobPostingBase.superRefine((data, ctx) => {
  if (!data.approverId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approverId"],
      message: "Penyetuju 1 wajib dipilih",
    });
  }
  if (!data.approver2Id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approver2Id"],
      message: "Penyetuju 2 wajib dipilih",
    });
  }
  if (data.approverId && data.approver2Id && data.approverId === data.approver2Id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approver2Id"],
      message: "Penyetuju 1 dan 2 harus berbeda",
    });
  }
  if (data.interviewLocation === "online" && !data.interviewLink?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interviewLink"],
      message: "Link interview wajib diisi untuk lokasi online",
    });
  }
  if (data.interviewLocation === "offline" && !data.interviewVenueId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interviewVenueId"],
      message: "Venue wajib dipilih untuk lokasi offline",
    });
  }
  if (data.interviewLocation === "hybrid" && (!data.interviewLink?.trim() || !data.interviewVenueId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interviewVenueId"],
      message: "Link dan venue wajib diisi untuk lokasi hybrid",
    });
  }
});

export const updateJobPostingSchema = jobPostingBase.partial();

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;
