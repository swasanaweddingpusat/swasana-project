import { z } from "zod";

export const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  customerId: z.string().optional().default(""),
  customerName: z.string().optional().default(""),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().optional().default(""),
  contactEmailCpw: z.string().optional().default(""),
  contactNikCpp: z.string().optional().default(""),
  contactNikCpw: z.string().optional().default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  // Optional: admin/manager assigns on behalf of a sales. When omitted, the
  // action falls back to the caller's own profileId.
  salesId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  bonuses: z.array(z.object({
    vendorId: z.string().min(1),
    vendorCategoryId: z.string().min(1),
    vendorName: z.string().min(1),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    nominal: z.coerce.number().min(0).default(0),
  })).optional().default([]),
  complimentaries: z.array(z.object({
    complimentaryId: z.string().optional().nullable(),
    name: z.string().min(1),
    price: z.coerce.number().int().min(0).default(0),
    isShowPrice: z.boolean().default(false),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  categoryToggles: z.array(z.object({
    categoryName: z.string().min(1),
    basePrice: z.coerce.number().int().min(0),
    sortOrder: z.coerce.number().int().default(0),
    isShow: z.boolean().default(true),
    isTakeout: z.boolean().default(false),
    takeoutNominal: z.coerce.number().int().min(0).default(0),
  })).optional().default([]),
  termOfPayments: z.array(z.object({
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
    paymentStatus: z.enum(["unpaid", "paid", "partial", "refund"]).default("unpaid"),
  })).optional().default([]),
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
  withMaterai: z.boolean().default(false),
  leadId: z.string().optional().nullable(),
});

export const updateBookingSchema = z.object({
  id: z.string().min(1),
  bookingDate: z.string().optional(),
  bookingStatus: z.enum(["Pending", "Uploaded", "Confirmed", "Rejected", "Canceled", "Lost"]).optional(),
  paymentStatus: z.string().optional(),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  rejectionNotes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
});

export const editBookingSchema = z.object({
  id: z.string().min(1),
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  weddingSession: z.enum(["morning", "evening", "fullday"]).optional().nullable(),
  weddingType: z.string().optional().nullable(),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  signingLocation: z.string().optional().nullable(),
  // Customer fields
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().optional().default(""),
  contactEmailCpw: z.string().optional().default(""),
  contactNikCpp: z.string().optional().default(""),
  contactNikCpw: z.string().optional().default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  bonuses: z.array(z.object({
    vendorId: z.string().min(1),
    vendorCategoryId: z.string().min(1),
    vendorName: z.string().min(1),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    nominal: z.coerce.number().min(0).default(0),
  })).optional().default([]),
  complimentaries: z.array(z.object({
    complimentaryId: z.string().optional().nullable(),
    name: z.string().min(1),
    price: z.coerce.number().int().min(0).default(0),
    isShowPrice: z.boolean().default(false),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  categoryToggles: z.array(z.object({
    categoryName: z.string().min(1),
    basePrice: z.coerce.number().int().min(0),
    sortOrder: z.coerce.number().int().default(0),
    isShow: z.boolean().default(true),
    isTakeout: z.boolean().default(false),
    takeoutNominal: z.coerce.number().int().min(0).default(0),
  })).optional().default([]),
  termOfPayments: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
    // Read-only status fields — sent by client for UI logic only.
    // Server ALWAYS re-fetches from DB and ignores these for authorization.
    paymentStatus: z.enum(["unpaid", "paid", "partial", "refund"]).optional(),
    ackStatus: z.string().optional(),
  })).optional().default([]),
  specialBonusName: z.string().optional().nullable(),
  specialBonusAmount: z.coerce.number().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
});

export const approveBookingSchema = z.object({
  id: z.string().min(1),
  signatureManager: z.string().min(1, "Tanda tangan manager wajib diisi"),
});

/** Client-info-only update: updates snapCustomer + customer master WITHOUT touching
 *  venue/package/TOP or triggering approval reset. Used by Step 1 "Save & Publish". */
export const updateBookingClientInfoSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  contactNumbers: z.string().optional().default(""),
  contactEmailCpp: z.string().optional().default(""),
  contactEmailCpw: z.string().optional().default(""),
  contactNikCpp: z.string().optional().default(""),
  contactNikCpw: z.string().optional().default(""),
  contactCppAddress: z.string().optional().default(""),
  contactCpwAddress: z.string().optional().default(""),
  contactBitrixId: z.string().optional().default(""),
  salesId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type EditBookingInput = z.infer<typeof editBookingSchema>;
export type UpdateBookingClientInfoInput = z.infer<typeof updateBookingClientInfoSchema>;
export type ApproveBookingInput = z.infer<typeof approveBookingSchema>;
