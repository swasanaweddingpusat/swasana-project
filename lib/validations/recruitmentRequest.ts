import { z } from "zod";

export const createRecruitmentRequestSchema = z.object({
  isWalkinInterview: z.boolean().default(false),
  company: z.string().optional().nullable(),
  documentDate: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  salary: z.number().min(0).optional().nullable(),
  quota: z.number().int().min(1).default(1),
  workLocation: z.string().optional().nullable(),
  interviewLocation: z.string().optional().nullable(),
  trainingCompanion: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  minEducation: z.string().optional().nullable(),
  minExperience: z.string().optional().nullable(),
  otherQualifications: z.string().optional().nullable(),
  jobDescriptions: z.array(z.string()).default([]),
  additionalNotes: z.array(z.string()).default([]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const updateRecruitmentRequestStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]),
  rejectionReason: z.string().optional().nullable(),
});

export type CreateRecruitmentRequestInput = z.infer<typeof createRecruitmentRequestSchema>;
export type UpdateRecruitmentRequestStatusInput = z.infer<typeof updateRecruitmentRequestStatusSchema>;
