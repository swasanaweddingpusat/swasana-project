import { z } from "zod";

export const mobileNumberEntrySchema = z.object({
  name: z.string().default(""),
  number: z.string().min(1, "Nomor HP wajib diisi"),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  mobileNumber: z.array(mobileNumberEntrySchema).min(1, "Minimal 1 nomor HP"),
  emailCpp: z.string().email("Email CPP tidak valid").optional().or(z.literal("")).transform((v) => v || undefined),
  emailCpw: z.string().email("Email CPW tidak valid").optional().or(z.literal("")).transform((v) => v || undefined),
  cppNik: z.string().length(16, "NIK CPP harus 16 digit").regex(/^\d+$/, "Hanya angka").optional().or(z.literal("")),
  cpwNik: z.string().length(16, "NIK CPW harus 16 digit").regex(/^\d+$/, "Hanya angka").optional().or(z.literal("")),
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

export type MobileNumberEntry = z.infer<typeof mobileNumberEntrySchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Raw form values before Zod transform — email fields as plain string (empty = no email) */
export type CustomerFormValues = Omit<CustomerInput, "emailCpp" | "emailCpw"> & {
  emailCpp: string;
  emailCpw: string;
};

/** Parse mobileNumber from DB (handles legacy comma-separated string + new Json format) */
export function parseMobileNumbers(raw: unknown): MobileNumberEntry[] {
  if (Array.isArray(raw)) return raw as MobileNumberEntry[];
  if (typeof raw === "string") {
    if (!raw) return [];
    return raw.split(",").map((n) => ({ name: "", number: n.trim() })).filter((e) => e.number);
  }
  return [];
}
