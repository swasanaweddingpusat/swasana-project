import { z } from "zod";

export const validateOnboardingFormSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().min(1),
});

export const submitOnboardingFormPublicSchema = z.object({
  token: z.string().min(1),
  accessCode: z.string().min(1),
  // Job info
  divisi: z.string().min(1, "Divisi wajib dipilih"),
  jabatan: z.string().min(1, "Jabatan wajib dipilih"),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  joinDate: z.string().min(1, "Tanggal bergabung wajib diisi"),
  // Personal info
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nickName: z.string().min(1, "Nama panggilan wajib diisi"),
  placeOfBirth: z.string().min(1, "Tempat lahir wajib diisi"),
  dateOfBirth: z.string().min(1, "Tanggal lahir wajib diisi"),
  phoneNumber: z.string().min(1, "Nomor HP wajib diisi"),
  email: z.string().email("Email tidak valid"),
  maritalStatus: z.enum(["single", "married", "divorced_alive", "divorced_dead"], {
    message: "Status pernikahan wajib dipilih",
  }),
  ktpAddress: z.string().min(1, "Alamat KTP wajib diisi"),
  currentAddress: z.string().min(1, "Alamat domisili wajib diisi"),
  motherName: z.string().min(1, "Nama ibu kandung wajib diisi"),
  numberOfChildren: z.coerce.number().int().min(0, "Jumlah anak tidak boleh negatif"),
  lastEducation: z.string().min(1, "Pendidikan terakhir wajib diisi"),
  emergencyContactName: z.string().min(1, "Nama kontak darurat wajib diisi"),
  emergencyContactRel: z.string().min(1, "Hubungan kontak darurat wajib diisi"),
  emergencyContactPhone: z.string().min(1, "Nomor HP kontak darurat wajib diisi"),
  bankName: z.string().min(1, "Nama bank wajib diisi"),
  bankAccountNumber: z.string().min(1, "Nomor rekening wajib diisi"),
  ktpFileUrl: z.string().optional().nullable(),
  kkFileUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

export const createOnboardingFormLinkSchema = z.object({
  name: z.string().min(1, "Nama onboarding wajib diisi"),
  expiryDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type ValidateOnboardingFormInput = z.infer<typeof validateOnboardingFormSchema>;
export type SubmitOnboardingFormPublicInput = z.infer<typeof submitOnboardingFormPublicSchema>;
export type CreateOnboardingFormLinkInput = z.infer<typeof createOnboardingFormLinkSchema>;
