import type { PayrollPeriodItem, PayrollPeriodDetail } from "@/lib/queries/payrollPeriods";

export async function fetchPayrollPeriods(): Promise<PayrollPeriodItem[]> {
  const res = await fetch("/api/hr/payroll-periods");
  if (!res.ok) throw new Error("Failed to fetch payroll periods");
  return res.json() as Promise<PayrollPeriodItem[]>;
}

export async function fetchPayrollPeriodById(id: string): Promise<PayrollPeriodDetail> {
  const res = await fetch(`/api/hr/payroll-periods/${id}`);
  if (!res.ok) throw new Error("Failed to fetch payroll period");
  return res.json() as Promise<PayrollPeriodDetail>;
}
