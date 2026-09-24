import { z } from 'zod';
import { fileDescriptorSchema, type FileDescriptor } from '@/lib/validations/common';

/** Descriptor persisted for every guestbook photo/proof file — path is a storage KEY, never a full URL. */
export { fileDescriptorSchema, type FileDescriptor };

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
    companyName: z.string().optional().nullable(),
    eventCategory: z.enum(['WEDDINGS', 'MICE']).optional().nullable(),
    email: z.string().email('Format email tidak valid').optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    bitrixContactId: z.string().optional().nullable(),
    bitrixName: z.string().optional().nullable(),
    bitrixSourceInfo: z.string().optional().nullable(),
    bitrixAdsUrl: z.string().optional().nullable(),
    interactionType: z.enum(['client_visit', 'online_meeting', 'jemput_bola']),
    onlineMedium: z.enum(['zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other']).optional().nullable(),
    meetingUrl: z.string().optional().nullable(),
    meetingLocation: z.string().optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
    hostId: z.string().optional().nullable(),
    venueId: z.string().optional().nullable(),
    checkInAt: z.string().min(1, 'Tanggal berkunjung wajib diisi'),
    notes: z.string().optional().nullable(),
    visitStatus: z.enum(['cold', 'warm', 'hot', 'done_visit', 'to_be_discuss', 'deal', 'lost']).optional().nullable(),
    sourceOfInformationId: z.string().optional().nullable(),
    packageId: z.string().optional().nullable(),
    segmentId: z.string().optional().nullable(),
    festivalId: z.string().optional().nullable(),
    proofFiles: proofFilesSchema,
    commitVisitDate: z.string().optional().nullable(),
    commitPayDate: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.eventCategory === 'MICE' && !val.segmentId?.trim()) {
      ctx.addIssue({
        path: ['segmentId'],
        code: z.ZodIssueCode.custom,
        message: 'Segmen wajib dipilih',
      });
    }

    if (val.eventCategory !== 'MICE' && !val.packageId?.trim()) {
      ctx.addIssue({
        path: ['packageId'],
        code: z.ZodIssueCode.custom,
        message: 'Paket wajib dipilih',
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
  visitStatus: z.enum(['cold', 'warm', 'hot', 'done_visit', 'to_be_discuss', 'deal', 'lost']).optional().nullable(),
  notes: z.string().optional().nullable(),
  sourceOfInformationId: z.string().optional().nullable(),
  packageId: z.string().optional().nullable(),
  segmentId: z.string().optional().nullable(),
  festivalId: z.string().optional().nullable(),
  visitorName: z.string().min(1).optional(),
  companyName: z.string().optional().nullable(),
  eventCategory: z.enum(['WEDDINGS', 'MICE']).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  bitrixContactId: z.string().optional().nullable(),
  bitrixName: z.string().optional().nullable(),
  bitrixSourceInfo: z.string().optional().nullable(),
  bitrixAdsUrl: z.string().optional().nullable(),
  interactionType: z.enum(['client_visit', 'online_meeting', 'jemput_bola']).optional(),
  onlineMedium: z.enum(['zoom', 'google_meet', 'whatsapp_call', 'microsoft_teams', 'other']).optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  meetingLocation: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  hostId: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  checkInAt: z.string().min(1, 'Tanggal berkunjung wajib diisi').optional(),
  checkOutAt: z.string().optional().nullable(),
  proofFiles: proofFilesSchema,
  commitVisitDate: z.string().optional().nullable(),
  commitPayDate: z.string().optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.eventCategory === 'MICE' && !val.segmentId?.trim()) {
    ctx.addIssue({
      path: ['segmentId'],
      code: z.ZodIssueCode.custom,
      message: 'Segmen wajib dipilih',
    });
  }

  if (val.eventCategory !== 'MICE' && !val.packageId?.trim()) {
    ctx.addIssue({
      path: ['packageId'],
      code: z.ZodIssueCode.custom,
      message: 'Paket wajib dipilih',
    });
  }
});

export type UpdateGuestbookEntryInput = z.infer<typeof updateGuestbookEntrySchema>;

/** Sumber informasi dianggap "dari Bitrix" kalau namanya mengandung kata "bitrix" — heuristik yang sama dipakai client (GuestbookDrawer) dan server (actions/guestbook.ts) supaya konsisten. */
export function isBitrixSourceName(name: string | null | undefined): boolean {
  return (name ?? "").toLowerCase().includes("bitrix");
}

/**
 * Label sumber untuk tabel/kartu guestbook.
 *
 * Entry dari Bitrix bisa datang lewat iklan atau organik, dan bedanya cuma
 * kelihatan dari ada/tidaknya ads URL. Tandai yang beriklan jadi
 * "Bitrix (Iklan)" supaya keduanya bisa dibedakan langsung dari list tanpa
 * membuka detail. Sumber non-Bitrix dikembalikan apa adanya.
 */
export function guestbookSourceLabel(
  sourceName: string | null | undefined,
  bitrixAdsUrl: string | null | undefined,
): string | null {
  const name = sourceName?.trim() || null;
  if (!name) return null;
  if (!isBitrixSourceName(name)) return name;
  return bitrixAdsUrl?.trim() ? `${name} (Iklan)` : name;
}
