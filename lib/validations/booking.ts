import { z } from "zod";

export const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Tanggal booking wajib diisi"),
  weddingSession: z.enum(["morning", "afternoon", "evening", "fullday"]).optional().nullable(),
  weddingType: z.enum(["wedding", "engagement", "akad", "resepsi", "other"]).optional().nullable(),
  customerId: z.string().min(1, "Customer wajib dipilih"),
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
  })).optional().default([]),
  termOfPayments: z.array(z.object({
    name: z.string().min(1),
    amount: z.coerce.number().min(0),
    dueDate: z.string().min(1),
    sortOrder: z.coerce.number().int().default(0),
  })).optional().default([]),
});

export const updateBookingSchema = z.object({
  id: z.string().min(1),
  bookingDate: z.string().optional(),
  bookingStatus: z.enum(["Pending", "Uploaded", "Confirmed", "Rejected", "Canceled", "Lost"]).optional(),
  paymentStatus: z.string().optional(),
  weddingSession: z.enum(["morning", "afternoon", "evening", "fullday"]).optional().nullable(),
  weddingType: z.enum(["wedding", "engagement", "akad", "resepsi", "other"]).optional().nullable(),
  rejectionNotes: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
