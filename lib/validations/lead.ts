import { z } from "zod";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export const contactNumberSchema = z.object({
  label: z.string().trim().max(50).optional().default(""),
  number: z
    .string()
    .trim()
    .min(7, "Nomor terlalu pendek")
    .max(15, "Nomor terlalu panjang")
    .regex(/^\d+$/, "Nomor hanya boleh berisi angka"),
});

// ─── Lead Schemas ─────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(200),
  contactNumbers: z
    .array(contactNumberSchema)
    .min(1, "Minimal 1 nomor HP/WA wajib diisi")
    .max(10),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  eventDate: z.string().optional().nullable(),
  estimatedPax: z.coerce.number().int().min(1).optional().nullable(),
  budgetRange: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  venueId: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  eventTypeId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  statusId: z.string().min(1, "Status wajib dipilih"),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  id: z.string().min(1),
});

export const leadFilterSchema = z.object({
  search: z.string().optional(),
  statusId: z.string().optional(),
  venueId: z.string().optional(),
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

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>;
export type CreateLeadStatusInput = z.infer<typeof createLeadStatusSchema>;
export type UpdateLeadStatusInput2 = z.infer<typeof updateLeadStatusSchema2>;
