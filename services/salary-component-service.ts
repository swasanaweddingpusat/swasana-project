import type { SalaryComponentAdminItem } from "@/lib/queries/salaryComponents";

export async function fetchSalaryComponents(): Promise<SalaryComponentAdminItem[]> {
  const res = await fetch("/api/hr/salary-components");
  if (!res.ok) throw new Error("Failed to fetch salary components");
  return res.json() as Promise<SalaryComponentAdminItem[]>;
}
