import { z } from 'zod';

/** Descriptor persisted for every guestbook photo/proof file — path is a storage KEY, never a full URL. */
export const fileDescriptorSchema = z.object({
  id: z.string().nullable().optional(),
  name_file_origin: z.string().nullable().optional(),
  mimetype: z.string().nullable().optional(),
  path: z.string(),
});

export type FileDescriptor = z.infer<typeof fileDescriptorSchema>;

export interface ProofFiles {
  photo?: FileDescriptor | null;
  chat?: FileDescriptor | null;
  lost?: FileDescriptor | null;
  reschedule?: FileDescriptor | null;
}

const proofFilesSchema = z
  .object({
    photo: fileDescriptorSchema.optional(),
    chat: fileDescriptorSchema.optional(),
    lost: fileDescriptorSchema.optional(),
    reschedule: fileDescriptorSchema.optional(),
  })
  .partial()
  .nullable()
  .optional();

export const createGuestbookEntrySchema = z
  .object({
    visitorName: z.string().min(1, 'Nama tamu wajib diisi'),
    email: z.string().email('Format email tidak valid').optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    bitrixContactId: z.string().optional().nullable(),
    bitrixName: z.string().optional().nullable(),
    bitrixSourceInfo: z.string().optional().nullable(),
    visitorPhoto: z.string().nullable().optional(),
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
    proofFiles: proofFilesSchema,
    commitVisitDate: z.string().optional().nullable(),
    commitPayDate: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.visitorPhoto) {
      ctx.addIssue({
        path: ['visitorPhoto'],
        code: z.ZodIssueCode.custom,
        message: 'Foto tamu wajib diupload',
      });
    }

    if (!val.proofFiles?.photo) {
      ctx.addIssue({
        path: ['proofFiles', 'photo'],
        code: z.ZodIssueCode.custom,
        message: 'Bukti Foto Visit wajib diupload',
      });
    }

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
  visitorPhoto: z.string().nullable().optional(),
  interactionType: z.enum(['client_visit', 'online_meeting', 'jemput_bola']).optional(),
  onlineMedium: z.enum(['zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other']).optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  meetingLocation: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  hostId: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  checkInAt: z.string().optional().nullable(),
  checkOutAt: z.string().optional().nullable(),
  proofFiles: proofFilesSchema,
  commitVisitDate: z.string().optional().nullable(),
  commitPayDate: z.string().optional().nullable(),
});

export type UpdateGuestbookEntryInput = z.infer<typeof updateGuestbookEntrySchema>;
