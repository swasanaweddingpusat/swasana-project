import { z } from "zod";

export const setEmployeeSalarySchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  salaryComponentId: z.string().min(1, "Komponen gaji wajib dipilih"),
  amount: z.number().min(0, "Jumlah tidak boleh negatif"),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const bulkSetEmployeeSalarySchema = z.object({
  profileIds: z.array(z.string()).min(1, "Pilih minimal satu karyawan"),
  salaryComponentId: z.string().min(1, "Komponen gaji wajib dipilih"),
  amount: z.number().min(0, "Jumlah tidak boleh negatif"),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export type SetEmployeeSalaryInput = z.infer<typeof setEmployeeSalarySchema>;
export type BulkSetEmployeeSalaryInput = z.infer<typeof bulkSetEmployeeSalarySchema>;
