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

const quotationComplimentarySchema = z.object({
  complimentaryId: z.string().optional().nullable(),
  name: z.string().min(1),
  price: z.coerce.number().int().min(0).default(0),
  isShowPrice: z.boolean().default(false),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

const quotationBonusSchema = z.object({
  bonusId: z.string().optional().nullable(),
  name: z.string().min(1),
  price: z.coerce.number().int().min(1).default(1),
  description: z.string().optional().nullable(),
  qty: z.coerce.number().int().min(1).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

const quotationPriceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  priceType: z.enum(["QTY", "NOMINAL"]).default("QTY"),
  qty: z.coerce.number().int().optional().nullable(),
  price: z.coerce.number().int().optional().nullable(),
  total: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

const quotationTaxDepositSchema = z.object({
  name: z.string().min(1),
  nominal: z.coerce.number().int().min(0).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

const quotationTermSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().int().min(0).default(0),
  dueDate: z.string().optional().nullable(),
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
  // Selected MICE package reference (frozen into SnapQuotationPackage on the server)
  packageId: z.string().optional().nullable(),
  packageName: z.string().optional().nullable(),
  pax: z.coerce.number().int().min(0).default(0),
  eventDate: z.string().optional().nullable(),
  eventEndDate: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  place: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  // Step 2 — Items + pricing
  items: z.array(quotationItemSchema).default([]),
  additionals: z.array(quotationItemSchema).default([]),
  prices: z.array(quotationPriceSchema).default([]),
  complimentaries: z.array(quotationComplimentarySchema).default([]),
  bonuses: z.array(quotationBonusSchema).default([]),
  discount: z.coerce.number().int().min(0).default(0),
  discountName: z.string().optional().nullable(),
  // Booking fee for the Term & Payment boilerplate (optional; auto-loaded from
  // the per-venue template, editable per quotation).
  bookingFee: z.coerce.number().int().min(0).optional().nullable(),
  // Step 4 — Term of Payment (TOP) + Tax & Deposit
  terms: z.array(quotationTermSchema).default([]),
  taxDeposits: z.array(quotationTaxDepositSchema).default([]),
  // Editable document clauses — fall back to a hardcoded default string in
  // quotation-preview.tsx when null (legacy rows / not yet customized).
  termAndCondition: z.string().optional().nullable(),
  paymentNote: z.string().optional().nullable(),
  cancellationPolicy: z.string().optional().nullable(),
  closingNote: z.string().optional().nullable(),
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
