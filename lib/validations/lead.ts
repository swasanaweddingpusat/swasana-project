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

// ─── Lead Schemas ─────────────────────────────────────────────────────────────

const baseLeadSchema = z.object({
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
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  eventDateAlt: z.string().optional().nullable(),
  time: z.string().trim().max(100).optional(),
  estimatedPax: z.coerce.number().int().min(1).optional().nullable(),
  budgetRange: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  instansi: z.string().trim().max(200).optional(),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  venueId: z.string().optional(),
  venueSecondaryId: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  eventTypeId: z.string().min(1, "Event type wajib dipilih"),
  sourceOfInformationId: z.string().min(1, "Sumber informasi wajib dipilih"),
  assignedToId: z.string().min(1, "Assign ke sales wajib dipilih"),
  statusId: z.string().min(1, "Status wajib dipilih"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional(),
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

export const createLeadSchema = baseLeadSchema
  .superRefine(requireWeddingSession)
  .superRefine(requireBookingFeeWhenLocked);

export const updateLeadSchema = baseLeadSchema
  .partial()
  .extend({ id: z.string().min(1) })
  .superRefine(requireWeddingSession)
  .superRefine(requireBookingFeeWhenLocked);

export const leadFilterSchema = z.object({
  search: z.string().optional(),
  scope: z.enum(["active", "deal", "lost"]).default("active"),
  statusId: z.string().optional(),
  venueId: z.string().optional(),
  eventTypeId: z.string().optional(),
  assignedToId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateLeadStatusSchema = z.object({
  id: z.string().min(1),
  statusId: z.string().min(1),
});

// ─── LeadStatus Schemas ───────────────────────────────────────────────────────

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

export type LeadScope = "active" | "deal" | "lost";

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type CreateLeadStatusInput = z.infer<typeof createLeadStatusSchema>;
export type UpdateLeadStatusInput2 = z.infer<typeof updateLeadStatusSchema2>;
export type BaseLeadInput = z.infer<typeof baseLeadSchema>;
