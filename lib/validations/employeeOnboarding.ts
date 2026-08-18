import { z } from "zod";

export const onboardingFormSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nickName: z.string().min(1, "Nama panggilan wajib diisi"),
  joinDate: z.coerce.date(),
  divisi: z.enum([
    "Sales",
    "Venue Specialist",
    "Operational",
    "Finance",
    "HR",
    "MICE",
    "IT & Design Creative",
    "Supporting",
  ]),
  jabatan: z.enum(["Staff", "Manager", "Direksi", "CEO"]),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  placeOfBirth: z.string().min(1, "Tempat lahir wajib diisi"),
  dateOfBirth: z.coerce.date(),
  phoneNumber: z.string().min(1, "Nomor HP wajib diisi"),
  email: z.string().email("Email tidak valid"),
  maritalStatus: z.enum(["single", "married", "divorced_alive", "divorced_dead"]),
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
});

export type OnboardingFormInput = z.infer<typeof onboardingFormSchema>;
