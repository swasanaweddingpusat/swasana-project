import type { PayrollSettingsResult } from "@/lib/queries/payrollSettings";

export async function fetchPayrollSettings(): Promise<PayrollSettingsResult> {
  const res = await fetch("/api/hr/payroll-settings");
  if (!res.ok) throw new Error("Failed to fetch payroll settings");
  return res.json() as Promise<PayrollSettingsResult>;
}
