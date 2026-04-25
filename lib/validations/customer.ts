import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  mobileNumber: z.string().min(1, "Nomor HP wajib diisi"),
  email: z.string().min(1, "Email wajib diisi").email("Email tidak valid"),
  nikNumber: z.string().length(16, "NIK harus 16 digit").regex(/^\d+$/, "Hanya angka").optional().or(z.literal("")),
  ktpAddress: z.string().optional(),
  type: z.string().min(1, "Type wajib diisi"),
  club: z.string().optional(),
  memberStatus: z.string().min(1, "Member status wajib diisi").default("Non-Member"),
  notes: z.string().optional(),
  bitrixId: z.string().optional(),
});

export const updateCustomerSchema = customerSchema.partial().extend({
  id: z.string().min(1),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
