import { z } from "zod";

export const addCandidateSchema = z.object({
  jobPostingId: z.string().min(1, "Lowongan wajib dipilih"),
  fullName: z.string().min(1, "Nama kandidat wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phoneNumber: z.string().optional(),
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

export type AddCandidateInput = z.infer<typeof addCandidateSchema>;
export type MoveCandidateStageInput = z.infer<typeof moveCandidateStageSchema>;
export type RejectCandidateInput = z.infer<typeof rejectCandidateSchema>;
export type RateCandidateInput = z.infer<typeof rateCandidateSchema>;
export type AddCandidateNoteInput = z.infer<typeof addCandidateNoteSchema>;
