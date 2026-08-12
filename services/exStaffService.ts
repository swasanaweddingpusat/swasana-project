import type { ExStaffItem } from "@/lib/queries/exStaff";

export async function fetchExStaff(): Promise<ExStaffItem[]> {
  const res = await fetch("/api/hr/ex-staff");
  if (!res.ok) throw new Error("Failed to fetch ex-staff");
  return res.json() as Promise<ExStaffItem[]>;
}
