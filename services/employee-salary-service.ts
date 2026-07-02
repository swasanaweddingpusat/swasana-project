import type { EmployeeSalaryItem } from "@/lib/queries/employeeSalaries";

export async function fetchEmployeeSalaries(params?: {
  profileId?: string;
  salaryComponentId?: string;
}): Promise<EmployeeSalaryItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.profileId) searchParams.set("profileId", params.profileId);
  if (params?.salaryComponentId) searchParams.set("salaryComponentId", params.salaryComponentId);

  const query = searchParams.toString();
  const url = query ? `/api/hr/employee-salaries?${query}` : "/api/hr/employee-salaries";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch employee salaries");
  return res.json() as Promise<EmployeeSalaryItem[]>;
}
