import { z } from "zod";

export const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;
