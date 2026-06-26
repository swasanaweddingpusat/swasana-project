import { z } from "zod";

export const createSalaryComponentSchema = z.object({
  name: z.string().min(1, "Nama komponen wajib diisi"),
  code: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "Code harus lowercase alphanumeric"),
  type: z.enum(["earning", "deduction"]),
  category: z.enum(["basic", "allowance", "deduction", "benefit"]),
  isFixed: z.boolean().default(true),
  isTaxable: z.boolean().default(true),
});

export const updateSalaryComponentSchema = createSalaryComponentSchema.partial();

export type CreateSalaryComponentInput = z.infer<typeof createSalaryComponentSchema>;
export type UpdateSalaryComponentInput = z.infer<typeof updateSalaryComponentSchema>;
