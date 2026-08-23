import { z } from "zod";

export const addCandidateSchema = z.object({
  jobPostingId: z.string().min(1, "Lowongan wajib dipilih"),
  fullName: z.string().min(1, "Nama kandidat wajib diisi"),
  email: z.string().email("Email tidak valid").trim().toLowerCase(),
  phoneNumber: z.string().optional(),
  expectedSalary: z.number().int().min(0).optional().nullable(),
});

export const moveCandidateStageSchema = z.object({
  candidateId: z.string().min(1),
  stage: z.enum(["applied", "screening", "interview", "assessment", "offering", "hired", "rejected"]),
});

export const rejectCandidateSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

export const rateCandidateSchema = z.object({
  candidateId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

export const addCandidateNoteSchema = z.object({
  candidateId: z.string().min(1),
  content: z.string().min(1, "Catatan wajib diisi"),
});

export const publicApplySchema = z.object({
  formToken: z.string().min(1, "Sesi form tidak valid, silakan muat ulang halaman"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Email tidak valid").trim().toLowerCase(),
  phoneNumber: z.string().optional(),
  religion: z.string().min(1, "Agama wajib dipilih"),
  expectedSalary: z
    .string()
    .min(1, "Gaji yang diharapkan wajib diisi")
    .regex(/^\d+$/, "Gaji harus berupa angka (contoh: 5000000)")
    .refine((v) => v.length <= 13, "Nilai gaji melebihi batas maksimum"),
});

function requiredFileSchema(label: string) {
  return z
    .instanceof(File, { message: `${label} wajib diunggah` })
    .refine((f) => f.size > 0, `${label} wajib diunggah`)
    .refine((f) => f.size <= 5 * 1024 * 1024, `Ukuran ${label} maksimum 5MB`);
}

export const publicApplyFilesSchema = z.object({
  cv: requiredFileSchema("CV"),
  photo: requiredFileSchema("Foto pelamar"),
  ktpPhoto: requiredFileSchema("Foto KTP"),
});

export const validateJobPostingAccessSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6, "Kode akses harus 6 karakter"),
});

export const validateCandidateInviteSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().length(6, "Kode akses harus 6 karakter"),
});

export const submitCandidateInviteSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().length(6, "Kode akses harus 6 karakter"),
  phoneNumber: z.string().optional(),
  religion: z.string().min(1, "Agama wajib dipilih"),
  expectedSalary: z
    .string()
    .min(1, "Gaji yang diharapkan wajib diisi")
    .regex(/^\d+$/, "Gaji harus berupa angka (contoh: 5000000)")
    .refine((v) => v.length <= 13, "Nilai gaji melebihi batas maksimum"),
});

export type PublicApplyInput = z.infer<typeof publicApplySchema>;
export type AddCandidateInput = z.infer<typeof addCandidateSchema>;
export type MoveCandidateStageInput = z.infer<typeof moveCandidateStageSchema>;
export type RejectCandidateInput = z.infer<typeof rejectCandidateSchema>;
export type RateCandidateInput = z.infer<typeof rateCandidateSchema>;
export type AddCandidateNoteInput = z.infer<typeof addCandidateNoteSchema>;
export type ValidateCandidateInviteInput = z.infer<typeof validateCandidateInviteSchema>;
export type SubmitCandidateInviteInput = z.infer<typeof submitCandidateInviteSchema>;
export type ValidateJobPostingAccessInput = z.infer<typeof validateJobPostingAccessSchema>;
