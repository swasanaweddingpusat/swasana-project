import { z } from "zod";

export const mobileNumberEntrySchema = z.object({
  name: z.string().default(""),
  number: z.string().min(1, "Nomor HP wajib diisi"),
});

/**
 * Object dasar TANPA refinement. Refinement dipisah supaya `.partial()` (update)
 * bisa dipakai — Zod v4 melarang `.partial()` pada schema yang sudah `.superRefine()`.
 */
const customerBaseSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  mobileNumber: z.array(mobileNumberEntrySchema).min(1, "Minimal 1 nomor HP"),
  emailCpp: z.string().email("Email CPP tidak valid").optional().or(z.literal("")).transform((v) => v || undefined),
  emailCpw: z.string().email("Email CPW tidak valid").optional().or(z.literal("")).transform((v) => v || undefined),
  cppIdType: z.enum(["KTP", "Paspor"]).default("KTP"),
  cpwIdType: z.enum(["KTP", "Paspor"]).default("KTP"),
  cppNik: z.string().optional().or(z.literal("")),
  cpwNik: z.string().optional().or(z.literal("")),
  ktpAddress: z.string().optional(),
  type: z.string().min(1, "Type wajib diisi"),
  club: z.string().optional(),
  memberStatus: z.string().min(1, "Member status wajib diisi").default("Non-Member"),
  notes: z.string().optional(),
  bitrixId: z.string().optional(),
});

/**
 * Cross-field checks. Semua field di-guard undefined supaya aman dipakai baik pada
 * create (full) maupun update (partial).
 */
function refineCustomer(
  data: Partial<z.infer<typeof customerBaseSchema>>,
  ctx: z.RefinementCtx,
): void {
  const cppNik = data.cppNik ?? "";
  if (cppNik !== "") {
    if (data.cppIdType === "KTP" && !/^\d{16}$/.test(cppNik)) {
      ctx.addIssue({ code: "custom", message: "NIK CPP harus 16 digit angka", path: ["cppNik"] });
    } else if (data.cppIdType === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(cppNik)) {
      ctx.addIssue({ code: "custom", message: "Paspor CPP harus 6–9 karakter alfanumerik", path: ["cppNik"] });
    }
  }
  const cpwNik = data.cpwNik ?? "";
  if (cpwNik !== "") {
    if (data.cpwIdType === "KTP" && !/^\d{16}$/.test(cpwNik)) {
      ctx.addIssue({ code: "custom", message: "NIK CPW harus 16 digit angka", path: ["cpwNik"] });
    } else if (data.cpwIdType === "Paspor" && !/^[A-Za-z0-9]{6,9}$/.test(cpwNik)) {
      ctx.addIssue({ code: "custom", message: "Paspor CPW harus 6–9 karakter alfanumerik", path: ["cpwNik"] });
    }
  }
}

export const customerSchema = customerBaseSchema.superRefine(refineCustomer);

export const updateCustomerSchema = customerBaseSchema
  .partial()
  .extend({
    id: z.string().min(1),
  })
  .superRefine(refineCustomer);

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
