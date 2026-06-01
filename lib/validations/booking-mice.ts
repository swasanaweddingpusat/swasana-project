import { z } from "zod";

export const miceTermSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.coerce.number().int().min(0),
  dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
  sortOrder: z.number().int().default(0),
  paymentStatus: z.enum(["unpaid", "paid", "partial"]).default("unpaid"),
});

export const createMiceBookingSchema = z.object({
  // Link to existing customer (reuse, no duplicate) or lead (auto-convert).
  // When both empty → a new customer is created from clientName/clientPhone.
  customerId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  clientName: z.string().trim().min(1, "Nama client wajib diisi").max(200),
  clientPhone: z
    .string()
    .trim()
    .min(7, "Nomor terlalu pendek")
    .max(15, "Nomor terlalu panjang")
    .regex(/^\d+$/, "Nomor hanya boleh angka"),
  email: z.string().trim().email("Format email tidak valid").optional().or(z.literal("")),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  eventTypeId: z.string().min(1, "Tipe event wajib dipilih"),
  eventDate: z.string().min(1, "Tanggal event wajib diisi"),
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  estimatedPax: z.coerce.number().int().min(1).optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  quotationId: z.string().optional().nullable(),
  salesId: z.string().optional().nullable(),
  salesSignature: z.string().optional().nullable(),
  signingLocation: z.string().trim().max(200).optional().nullable(),
  terms: z.array(miceTermSchema).min(1, "Minimal 1 term of payment wajib diisi"),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMiceBookingSchema = createMiceBookingSchema.partial().extend({
  id: z.string().min(1),
});

export const markMiceLostSchema = z.object({
  id: z.string().min(1),
  lostReason: z.string().trim().max(500).optional(),
});

export type CreateMiceBookingInput = z.infer<typeof createMiceBookingSchema>;
export type UpdateMiceBookingInput = z.infer<typeof updateMiceBookingSchema>;
export type MarkMiceLostInput = z.infer<typeof markMiceLostSchema>;
