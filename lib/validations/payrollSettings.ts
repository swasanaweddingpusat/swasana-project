import { z } from "zod";

export const updatePayrollSettingsSchema = z.object({
  pph21Method: z.enum(["ter", "progressive"]),
  bpjsKesCompanyRate: z.number().min(0).max(100),
  bpjsKesEmployeeRate: z.number().min(0).max(100),
  bpjsKesMaxSalary: z.number().min(0),
  jhtCompanyRate: z.number().min(0).max(100),
  jhtEmployeeRate: z.number().min(0).max(100),
  jkkRate: z.number().min(0).max(100),
  jkmRate: z.number().min(0).max(100),
  jpCompanyRate: z.number().min(0).max(100),
  jpEmployeeRate: z.number().min(0).max(100),
  jpMaxSalary: z.number().min(0),
  absenceDeductionPerDay: z.number().min(0),
  lateDeductionPerIncident: z.number().min(0),
});

export type UpdatePayrollSettingsInput = z.infer<typeof updatePayrollSettingsSchema>;
