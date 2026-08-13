import { z } from "zod";

export const createGuestbookEntrySchema = z.object({
  visitorName: z.string().min(1, "Nama tamu wajib diisi"),
  company: z.string().optional().nullable(),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
  visitorPhotoUrl: z.string().optional().nullable(),
  idPhotoUrl: z.string().optional().nullable(),
  purpose: z.enum(["client_visit", "vendor_meeting", "interview", "delivery", "other"]).default("other"),
  purposeNote: z.string().optional().nullable(),
  hostId: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  numberOfGuests: z.number().int().min(1).default(1),
  checkInAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  visitStatus: z.enum(["deal", "to_be_discuss", "not_joined"]).optional().nullable(),
  notJoinReason: z.string().optional().nullable(),
});

export type CreateGuestbookEntryInput = z.infer<typeof createGuestbookEntrySchema>;

export const checkOutGuestbookEntrySchema = z.object({
  checkOutAt: z.string().optional().nullable(),
});

export const updateGuestbookEntrySchema = z.object({
  visitStatus: z.enum(["deal", "to_be_discuss", "not_joined"]).optional().nullable(),
  notJoinReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateGuestbookEntryInput = z.infer<typeof updateGuestbookEntrySchema>;
