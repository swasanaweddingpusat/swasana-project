import { z } from "zod";

// ─── MICE Draft Schemas ───────────────────────────────────────────────────────

export const createMiceDraftStep1Schema = z.object({
  /** Client-generated idempotency key. When provided, server uses it as the booking id
   *  so that retries don't create duplicate draft rows. */
  id: z.string().optional().nullable(),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  eventEndDate: z.string().optional().nullable(),
  eventTypeId: z.string().min(1, "Tipe event wajib dipilih"),
  salesId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  miceSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  eventTime: z.string().trim().max(50).optional().nullable(),
  estimatedPax: z.coerce.number().int().min(1).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),

  customerId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),

  clientName: z.string().trim().max(200).optional(),
  clientPhone: z.string().trim().max(20).optional(),
  companyName: z.string().trim().max(200).optional().nullable(),
});

export type CreateMiceDraftStep1Input = z.infer<typeof createMiceDraftStep1Schema>;

// ─── MICE Draft Step 2: Terms of Payment ─────────────────────────────────────

const miceDraftTermSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.coerce.number().int().min(0),
  dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
  sortOrder: z.coerce.number().int().default(0),
  paymentStatus: z.enum(["unpaid", "paid", "partial"]).default("unpaid"),
});

export const updateMiceDraftStep2Schema = z.object({
  termOfPayments: z.array(miceDraftTermSchema).optional().default([]),
});

export type UpdateMiceDraftStep2Input = z.infer<typeof updateMiceDraftStep2Schema>;

// ─── MICE Draft Step 3: Signature/Location ───────────────────────────────────

export const updateMiceDraftStep3Schema = z.object({
  signingLocation: z.string().trim().max(200).optional().nullable(),
  signatureSales: z.string().optional().nullable(),
});

export type UpdateMiceDraftStep3Input = z.infer<typeof updateMiceDraftStep3Schema>;

// ─── Finalize MICE Draft ──────────────────────────────────────────────────────

export const finalizeMiceDraftSchema = z.object({
  draftId: z.string().min(1, "Draft ID wajib diisi"),
  signingLocation: z.string().trim().max(200).optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
});

export type FinalizeMiceDraftInput = z.infer<typeof finalizeMiceDraftSchema>;
