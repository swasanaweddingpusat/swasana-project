import { z } from "zod";

export const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  weddingSession: z.enum(["morning", "afternoon", "evening", "fullday"]).optional().nullable(),
  weddingType: z.enum(["wedding", "engagement", "akad", "resepsi", "other"]).optional().nullable(),
  customerId: z.string().optional().default(""),
  customerName: z.string().optional().default(""),
  contactNumbers: z.string().optional().default(""),
  contactEmail: z.string().optional().default(""),
  contactNik: z.string().optional().default(""),
  contactKtpAddress: z.string().optional().default(""),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  packageVariantId: z.string().optional().nullable(),
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
  termOfPayments: z.array(z.object({
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
  signingLocation: z.string().optional().nullable(),
  signatureSales: z.string().optional().nullable(),
});

export const updateBookingSchema = z.object({
  id: z.string().min(1),
  bookingDate: z.string().optional(),
  bookingStatus: z.enum(["Pending", "Uploaded", "Confirmed", "Rejected", "Canceled", "Lost"]).optional(),
  paymentStatus: z.string().optional(),
  weddingSession: z.enum(["morning", "afternoon", "evening", "fullday"]).optional().nullable(),
  weddingType: z.enum(["wedding", "engagement", "akad", "resepsi", "other"]).optional().nullable(),
  rejectionNotes: z.string().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
});

export const editBookingSchema = z.object({
  id: z.string().min(1),
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  weddingSession: z.enum(["morning", "afternoon", "evening", "fullday"]).optional().nullable(),
  weddingType: z.enum(["wedding", "engagement", "akad", "resepsi", "other"]).optional().nullable(),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  packageId: z.string().min(1, "Package wajib dipilih"),
  packageVariantId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  signingLocation: z.string().optional().nullable(),
  // Customer fields
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  contactNumbers: z.string().optional().default(""),
  contactEmail: z.string().optional().default(""),
  contactNik: z.string().optional().default(""),
  contactKtpAddress: z.string().optional().default(""),
  bonuses: z.array(z.object({
    vendorId: z.string().min(1),
    vendorCategoryId: z.string().min(1),
    vendorName: z.string().min(1),
    description: z.string().optional().nullable(),
    qty: z.coerce.number().int().min(1).default(1),
    nominal: z.coerce.number().min(0).default(0),
  })).optional().default([]),
});

export const approveBookingSchema = z.object({
  id: z.string().min(1),
  signatureManager: z.string().min(1, "Tanda tangan manager wajib diisi"),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type EditBookingInput = z.infer<typeof editBookingSchema>;
export type ApproveBookingInput = z.infer<typeof approveBookingSchema>;
