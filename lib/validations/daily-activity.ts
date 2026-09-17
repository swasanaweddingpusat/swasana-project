import { z } from "zod";

// ─── Daily Activity (new lean model → table "daily_activities", db.dailyActivity) ─
//
// This is the NEW Daily Activity feature (sales prospecting log), distinct from the
// legacy lead-picker plumbing that now lives in lib/validations/lead.ts. Fields map
// 1:1 to the DailyActivity model in prisma/schema.prisma.

export const PROGRESS_STATUS_VALUES = [
  "COLD",
  "WARM",
  "HOT",
  "FREEZE",
  "DEAL",
  "LOST",
] as const;

export const progressStatusSchema = z.enum(PROGRESS_STATUS_VALUES);

const baseDailyActivitySchema = z.object({
  salesId: z.string().min(1, "Sales wajib dipilih"),
  activityDate: z.string().min(1, "Tanggal aktivitas wajib diisi"),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  segmentId: z.string().min(1, "Segment wajib dipilih"),
  sourceOfInformationId: z.string().min(1, "Sumber informasi wajib dipilih"),
  sourceOfInformationDetail: z.string().trim().max(500).optional().or(z.literal("")),
  milestone: z.string().trim().min(1, "Milestone wajib diisi").max(500),
  progressStatus: progressStatusSchema,
  bitrixId: z.string().trim().max(100).optional().or(z.literal("")),
  contactName: z.string().trim().max(200).optional().or(z.literal("")),
  phoneNumber: z
    .string()
    .trim()
    .max(20, "Nomor terlalu panjang")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  location: z.string().trim().max(500).optional().or(z.literal("")),
  siteVisitAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createDailyActivitySchema = baseDailyActivitySchema;

export const updateDailyActivitySchema = baseDailyActivitySchema.partial().extend({
  id: z.string().min(1),
});

export const dailyActivityFilterSchema = z.object({
  search: z.string().optional(),
  progressStatus: progressStatusSchema.optional(),
  segmentId: z.string().optional(),
  salesId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type ProgressStatus = z.infer<typeof progressStatusSchema>;
export type CreateDailyActivityInput = z.infer<typeof createDailyActivitySchema>;
export type UpdateDailyActivityInput = z.infer<typeof updateDailyActivitySchema>;
export type DailyActivityFilterInput = z.infer<typeof dailyActivityFilterSchema>;
