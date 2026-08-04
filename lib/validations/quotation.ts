import { z } from "zod";

const quotationItemSchema = z.object({
  title: z.string().min(1, "Judul item wajib diisi"),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).default(0),
  manualTotal: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const createQuotationSchema = z.object({
  // Step 1 — Informasi
  clientName: z.string().min(1, "Nama client wajib diisi"),
  clientPhone: z.string().optional().nullable(),
  instansi: z.string().optional().nullable(),
  salesId: z.string().min(1, "Sales wajib dipilih"),
  venueId: z.string().optional().nullable(),
  // Snapshots (name at creation time for display/PDF)
  venueName: z.string().optional().nullable(),
  eventTypeId: z.string().optional().nullable(),
  eventTypeName: z.string().optional().nullable(),
  category: z.enum(["WEDDINGS", "MICE"]).default("WEDDINGS"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  eventDate: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  place: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  // Step 2 — Items + pricing
  items: z.array(quotationItemSchema).min(1, "Minimal satu item wajib diisi"),
  discount: z.coerce.number().int().min(0).default(0),
  // Booking fee for the Term & Payment boilerplate (optional; auto-loaded from
  // the per-venue template, editable per quotation).
  bookingFee: z.coerce.number().int().min(0).optional().nullable(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  // Step 3 — TTD
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
});

export const updateQuotationSchema = createQuotationSchema.partial().extend({
  id: z.string().min(1, "ID quotation wajib ada"),
  status: z.enum(["draft", "sent", "revised", "accepted", "rejected"]).optional(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
