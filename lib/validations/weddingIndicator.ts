import { z } from "zod";

const projectManagerSchema = z.object({
  name: z.string().min(1, "Nama PM wajib diisi"),
  rating: z.number().nullable().optional(),
  notes: z.string().optional().default(""),
});

const postWeddingWishesSchema = z.object({
  logamMulia: z.boolean().default(false),
  mobil: z.boolean().default(false),
  rumah: z.boolean().default(false),
  honeymoon: z.boolean().default(false),
  romanticDinner: z.boolean().default(false),
  umroh: z.boolean().default(false),
  custom1: z.string().optional().default(""),
  custom2: z.string().optional().default(""),
});

export const createWeddingIndicatorSchema = z.object({
  coupleName: z.string().min(1, "Nama pasangan wajib diisi"),
  eventDate: z.coerce.date({ message: "Tanggal acara wajib diisi" }),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  eventManagerName: z.string().min(1, "Nama Event Manager wajib diisi"),
  eventManagerRating: z.number().nullable().optional(),
  eventManagerNotes: z.string().optional().default(""),
  projectManagers: z.array(projectManagerSchema).optional().default([]),
  woName: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null)
    .nullable(),
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
  postWeddingWishes: postWeddingWishesSchema.optional(),
  notes: z.string().optional().default(""),
});

export const updateWeddingIndicatorSchema = createWeddingIndicatorSchema;

export const weddingIndicatorFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().optional(),
  venueId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateWeddingIndicatorInput = z.infer<typeof createWeddingIndicatorSchema>;
export type UpdateWeddingIndicatorInput = z.infer<typeof updateWeddingIndicatorSchema>;
export type WeddingIndicatorFilters = z.infer<typeof weddingIndicatorFilterSchema>;
export type ProjectManager = z.infer<typeof projectManagerSchema>;
export type PostWeddingWishes = z.infer<typeof postWeddingWishesSchema>;
