import { z } from "zod";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export const contactNumberSchema = z.object({
  label: z.string().trim().min(1, "Label wajib diisi").max(50),
  number: z
    .string()
    .trim()
    .min(7, "Nomor terlalu pendek")
    .max(15, "Nomor terlalu panjang")
    .regex(/^\d+$/, "Nomor hanya boleh berisi angka"),
});

// ─── Daily Activity Schemas ───────────────────────────────────────────────────

const baseDailyActivitySchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(200),
  contactNumbers: z
    .array(contactNumberSchema)
    .min(1, "Minimal 1 nomor HP/WA wajib diisi")
    .max(10),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  emailCpp: z.string().trim().email("Format email CP Pria tidak valid").optional().or(z.literal("")),
  emailCpw: z.string().trim().email("Format email CP Wanita tidak valid").optional().or(z.literal("")),
  nikCpp: z
    .string()
    .trim()
    .length(16, "NIK CP Pria harus 16 digit")
    .regex(/^\d+$/, "NIK CP Pria hanya boleh berisi angka")
    .optional()
    .or(z.literal("")),
  nikCpw: z
    .string()
    .trim()
    .length(16, "NIK CP Wanita harus 16 digit")
    .regex(/^\d+$/, "NIK CP Wanita hanya boleh berisi angka")
    .optional()
    .or(z.literal("")),
  addressCpp: z.string().trim().max(1000).optional(),
  addressCpw: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(500).optional(),
  // Wajib hanya untuk WEDDINGS (dienforce via requireWeddingEventFields).
  // MICE tidak mengirim tanggal event → biarkan optional di level dasar.
  eventDate: z.string().optional().or(z.literal("")),
  eventDateAlt: z.string().optional().nullable(),
  time: z.string().trim().max(100).optional(),
  estimatedPax: z.coerce.number().int().min(1).optional().nullable(),
  budgetRange: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  // Legacy free-text MICE segment — dipertahankan sementara untuk kompat; UI baru pakai segmentId.
  instansi: z.string().trim().max(200).optional(),
  // FK ke DailyActivitySegment (MICE segment ternormalisasi). Null utk wedding.
  segmentId: z.string().optional().nullable(),
  // MICE prospecting: IG boleh username saja ATAU full URL (disimpan apa adanya, tak dinormalisasi).
  instagramUrl: z.string().trim().max(200, "Instagram terlalu panjang").optional().or(z.literal("")),
  // MICE prospecting: jadwal site visit ("YYYY-MM-DD"). Opsional.
  siteVisitDate: z.string().optional().or(z.literal("")),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  venueId: z.string().optional(),
  venueSecondaryId: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  // Wajib hanya untuk WEDDINGS (dienforce via requireWeddingEventFields).
  eventTypeId: z.string().optional().or(z.literal("")),
  sourceOfInformationId: z.string().min(1, "Sumber informasi wajib dipilih"),
  assignedToId: z.string().min(1, "Assign ke sales wajib dipilih"),
  statusId: z.string().min(1, "Status wajib dipilih"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional(),
  weddingSessionAlt: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  bitrixId: z.string().trim().max(100).optional().nullable(),
  // Date locking & booking fee
  isDateLocked: z.boolean().default(false),
  bookingFeeAmount: z.coerce.number().int().min(0).optional().nullable(),
  bookingFeeDate: z.string().optional().nullable(),
  bookingFeeEvidenceUrl: z.string().trim().max(500).optional().nullable(),
});

// Weddings require a session; MICE does not.
const requireWeddingSession = (
  data: { category?: "WEDDINGS" | "MICE"; weddingSession?: "morning" | "evening" | "fullday" },
  ctx: z.RefinementCtx,
) => {
  if (data.category === "WEDDINGS" && !data.weddingSession) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weddingSession"],
      message: "Session wajib dipilih untuk wedding",
    });
  }
};

// WEDDINGS require an event date and event type; MICE leads (company/instansi funnel)
// do not collect these in the UI, so they stay optional for that category.
const requireWeddingEventFields = (
  data: { category?: "WEDDINGS" | "MICE"; eventDate?: string; eventTypeId?: string },
  ctx: z.RefinementCtx,
) => {
  if (data.category !== "WEDDINGS") return;
  if (!data.eventDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventDate"],
      message: "Tanggal event wajib diisi",
    });
  }
  if (!data.eventTypeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventTypeId"],
      message: "Event type wajib dipilih",
    });
  }
};

// When isDateLocked is true, bookingFeeAmount, bookingFeeDate, and bookingFeeEvidenceUrl
// are all required. Evidence URL is set server-side after upload; client passes it explicitly.
const requireBookingFeeWhenLocked = (
  data: {
    isDateLocked?: boolean;
    bookingFeeAmount?: number | null;
    bookingFeeDate?: string | null;
    bookingFeeEvidenceUrl?: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (!data.isDateLocked) return;
  if (!data.bookingFeeAmount || data.bookingFeeAmount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingFeeAmount"],
      message: "Nominal booking fee wajib diisi saat tanggal dikunci",
    });
  }
  if (!data.bookingFeeDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingFeeDate"],
      message: "Tanggal terima booking fee wajib diisi",
    });
  }
  if (!data.bookingFeeEvidenceUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingFeeEvidenceUrl"],
      message: "Bukti bayar wajib diunggah saat tanggal dikunci",
    });
  }
};

// For WEDDINGS: weddingSessionAlt is required when eventDateAlt is provided.
const requireAltSession = (
  data: {
    category?: "WEDDINGS" | "MICE";
    eventDateAlt?: string | null;
    weddingSessionAlt?: "morning" | "evening" | "fullday" | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.category === "WEDDINGS" && data.eventDateAlt && !data.weddingSessionAlt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weddingSessionAlt"],
      message: "Session tanggal alternatif wajib dipilih untuk wedding",
    });
  }
};

// Alternative event date, when provided, must differ from the primary event date.
const requireDistinctEventDates = (
  data: { eventDate?: string; eventDateAlt?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.eventDateAlt && data.eventDate && data.eventDateAlt === data.eventDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventDateAlt"],
      message: "Tanggal alternatif tidak boleh sama dengan tanggal utama",
    });
  }
};

export const createDailyActivitySchema = baseDailyActivitySchema
  .superRefine(requireWeddingSession)
  .superRefine(requireWeddingEventFields)
  .superRefine(requireAltSession)
  .superRefine(requireBookingFeeWhenLocked)
  .superRefine(requireDistinctEventDates);

export const updateDailyActivitySchema = baseDailyActivitySchema
  .partial()
  .extend({ id: z.string().min(1) })
  .superRefine(requireWeddingSession)
  .superRefine(requireWeddingEventFields)
  .superRefine(requireAltSession)
  .superRefine(requireBookingFeeWhenLocked)
  .superRefine(requireDistinctEventDates);

export const dailyActivityFilterSchema = z.object({
  search: z.string().optional(),
  scope: z.enum(["active", "deal", "lost"]).default("active"),
  statusId: z.string().optional(),
  venueId: z.string().optional(),
  eventTypeId: z.string().optional(),
  segmentId: z.string().optional(),
  assignedToId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateDailyActivityStatusSchema = z.object({
  id: z.string().min(1),
  statusId: z.string().min(1),
});

// ─── LeadStatus Schemas (settings-lead-status — kept as-is) ───────────────────

export const createLeadStatusSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format warna tidak valid (hex)")
    .default("#6b7280"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  isFinal: z.boolean().default(false),
});

export const updateLeadStatusSchema2 = createLeadStatusSchema.partial().extend({
  id: z.string().min(1),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type DailyActivityScope = "active" | "deal" | "lost";

export type CreateDailyActivityInput = z.infer<typeof createDailyActivitySchema>;
export type UpdateDailyActivityInput = z.infer<typeof updateDailyActivitySchema>;
export type DailyActivityFilterInput = z.infer<typeof dailyActivityFilterSchema>;
export type UpdateDailyActivityStatusInput = z.infer<typeof updateDailyActivityStatusSchema>;
export type CreateLeadStatusInput = z.infer<typeof createLeadStatusSchema>;
export type UpdateLeadStatusInput2 = z.infer<typeof updateLeadStatusSchema2>;
export type BaseDailyActivityInput = z.infer<typeof baseDailyActivitySchema>;
export type WeddingSessionAltInput = "morning" | "evening" | "fullday" | null | undefined;
