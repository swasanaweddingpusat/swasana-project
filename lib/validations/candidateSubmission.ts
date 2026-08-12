import { z } from "zod";

export const validateRecruitmentFormSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().min(1),
});

export const submitCandidateSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().min(1),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phoneNumber: z.string().min(1, "No. telepon wajib diisi"),
  address: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  lastEducation: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  workExperienceYears: z.number().int().min(0).optional().nullable(),
  workHistory: z.string().optional().nullable(),
  cvUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

export type ValidateRecruitmentFormInput = z.infer<typeof validateRecruitmentFormSchema>;
export type SubmitCandidateInput = z.infer<typeof submitCandidateSchema>;
