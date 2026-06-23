import type { WorkLocationItem } from "@/lib/queries/workLocations";

export async function fetchWorkLocations(): Promise<WorkLocationItem[]> {
  const res = await fetch("/api/hr/work-locations");
  if (!res.ok) throw new Error("Failed to fetch work locations");
  return res.json() as Promise<WorkLocationItem[]>;
}
