import type { WorkShiftItem } from "@/lib/queries/workShifts";

export async function fetchWorkShifts(): Promise<WorkShiftItem[]> {
  const res = await fetch("/api/hr/work-shifts");
  if (!res.ok) throw new Error("Failed to fetch work shifts");
  return res.json() as Promise<WorkShiftItem[]>;
}
