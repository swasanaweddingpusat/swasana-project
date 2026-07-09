import { z } from "zod";

export const validateShareSchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
  accessCode: z.string().min(1, "Kode akses wajib diisi"),
});

export const saveShareSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().min(1),
  coupleName: z.string().min(1, "Nama pasangan wajib diisi"),
  eventDate: z.string().min(1, "Tanggal acara wajib diisi"),
  venueId: z.string().min(1),
  eventManagerName: z.string().min(1, "Nama Event Manager wajib diisi"),
  eventManagerRating: z.number().nullable().optional(),
  eventManagerNotes: z.string().optional().default(""),
  projectManagers: z
    .array(
      z.object({
        name: z.string().min(1),
        rating: z.number().nullable().optional(),
        notes: z.string().optional().default(""),
      })
    )
    .optional()
    .default([]),
  woName: z.string().optional().default(""),
  woRating: z.number().nullable().optional(),
  woNotes: z.string().optional().default(""),
  ballroomFacilitiesRating: z.number().nullable().optional(),
  ballroomFacilitiesNotes: z.string().optional().default(""),
  ballroomCleanlinessRating: z.number().nullable().optional(),
  ballroomCleanlinessNotes: z.string().optional().default(""),
  vendorsRating: z.number().nullable().optional(),
  vendorsNotes: z.string().optional().default(""),
  salesRating: z.number().nullable().optional(),
  salesNotes: z.string().optional().default(""),
  recommendationScore: z.number().int().min(0).max(10).default(5),
  postWeddingWishes: z
    .object({
      logamMulia: z.boolean().default(false),
      mobil: z.boolean().default(false),
      rumah: z.boolean().default(false),
      honeymoon: z.boolean().default(false),
      romanticDinner: z.boolean().default(false),
      umroh: z.boolean().default(false),
      custom1: z.string().optional().default(""),
      custom2: z.string().optional().default(""),
    })
    .optional(),
  notes: z.string().optional().default(""),
  signatures: z.record(z.string(), z.string().nullable()).optional(),
  signatureNames: z.record(z.string(), z.string()).optional(),
  signatureDate: z.string().optional().default(""),
});

export type ValidateShareInput = z.infer<typeof validateShareSchema>;
export type SaveShareInput = z.infer<typeof saveShareSchema>;
