import { z } from 'zod';

export const createGuestbookEntrySchema = z
  .object({
    visitorName: z.string().min(1, 'Nama tamu wajib diisi'),
    email: z.string().email('Format email tidak valid').optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    bitrixContactId: z.string().optional().nullable(),
    bitrixName: z.string().optional().nullable(),
    bitrixSourceInfo: z.string().optional().nullable(),
    visitorPhotoUrl: z.string().optional().nullable(),
    purpose: z.enum(['client_visit', 'vendor_meeting', 'interview', 'delivery', 'other']).default('other'),
    purposeNote: z.string().optional().nullable(),
    interactionType: z.enum(['client_visit', 'online_meeting', 'jemput_bola']),
    onlineMedium: z.enum(['zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other']).optional().nullable(),
    meetingUrl: z.string().optional().nullable(),
    meetingLocation: z.string().optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
    hostId: z.string().optional().nullable(),
    venueId: z.string().optional().nullable(),
    checkInAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    visitStatus: z.enum(['deal', 'in_progress', 'pending', 'to_be_discuss', 'lost']).optional().nullable(),
    sourceOfInformationId: z.string().optional().nullable(),
    packageId: z.string().optional().nullable(),
    proofPhotoUrl: z.string().optional().nullable(),
    proofChatUrl: z.string().optional().nullable(),
    proofLostUrl: z.string().optional().nullable(),
    proofRescheduleUrl: z.string().optional().nullable(),
    commitVisitDate: z.string().optional().nullable(),
    commitPayDate: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.interactionType === 'online_meeting') {
      if (!val.onlineMedium) {
        ctx.addIssue({
          path: ['onlineMedium'],
          code: z.ZodIssueCode.custom,
          message: 'Medium online meeting wajib diisi',
        });
      }
      if (val.onlineMedium !== 'whatsapp_call' && !val.meetingUrl?.trim()) {
        ctx.addIssue({
          path: ['meetingUrl'],
          code: z.ZodIssueCode.custom,
          message: 'Link meeting wajib diisi',
        });
      }
    }

    if (val.interactionType === 'jemput_bola' && !val.meetingLocation?.trim()) {
      ctx.addIssue({
        path: ['meetingLocation'],
        code: z.ZodIssueCode.custom,
        message: 'Lokasi kunjungan wajib diisi',
      });
    }

    if (val.interactionType === 'client_visit' && !val.venueId && !val.meetingLocation?.trim()) {
      ctx.addIssue({
        path: ['venueId'],
        code: z.ZodIssueCode.custom,
        message: 'Pilih venue atau isi lokasi kunjungan',
      });
    }
  });

export type CreateGuestbookEntryInput = z.infer<typeof createGuestbookEntrySchema>;

export const checkOutGuestbookEntrySchema = z.object({
  checkOutAt: z.string().optional().nullable(),
});

export const updateGuestbookEntrySchema = z.object({
  visitStatus: z.enum(['deal', 'in_progress', 'pending', 'to_be_discuss', 'lost']).optional().nullable(),
  notes: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  visitorName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  bitrixContactId: z.string().optional().nullable(),
  bitrixName: z.string().optional().nullable(),
  bitrixSourceInfo: z.string().optional().nullable(),
  visitorPhotoUrl: z.string().optional().nullable(),
  purpose: z.enum(['client_visit', 'vendor_meeting', 'interview', 'delivery', 'other']).optional(),
  purposeNote: z.string().optional().nullable(),
  interactionType: z.enum(['client_visit', 'online_meeting', 'jemput_bola']).optional(),
  onlineMedium: z.enum(['zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other']).optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  meetingLocation: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  hostId: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  checkInAt: z.string().optional().nullable(),
  proofPhotoUrl: z.string().optional().nullable(),
  proofChatUrl: z.string().optional().nullable(),
  proofLostUrl: z.string().optional().nullable(),
  proofRescheduleUrl: z.string().optional().nullable(),
  commitVisitDate: z.string().optional().nullable(),
  commitPayDate: z.string().optional().nullable(),
});

export type UpdateGuestbookEntryInput = z.infer<typeof updateGuestbookEntrySchema>;
