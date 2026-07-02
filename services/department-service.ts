import type { DepartmentItem } from "@/lib/queries/departments";

export async function fetchDepartments(): Promise<DepartmentItem[]> {
  const res = await fetch("/api/hr/departments");
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json() as Promise<DepartmentItem[]>;
}
