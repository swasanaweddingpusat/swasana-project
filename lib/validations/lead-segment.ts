import { z } from "zod";

// ─── Create ───────────────────────────────────────────────────────────────────

export const createLeadSegmentSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama terlalu panjang"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateLeadSegmentSchema = createLeadSegmentSchema.partial().extend({
  id: z.string().min(1),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateLeadSegmentInput = z.infer<typeof createLeadSegmentSchema>;
export type UpdateLeadSegmentInput = z.infer<typeof updateLeadSegmentSchema>;
