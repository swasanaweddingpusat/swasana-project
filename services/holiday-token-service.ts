import type { AvailableHolidayTokenItem } from "@/lib/queries/publicHoliday";

export async function fetchAvailableHolidayTokens(): Promise<AvailableHolidayTokenItem[]> {
  const res = await fetch("/api/hr/holiday-tokens");
  if (!res.ok) throw new Error("Failed to fetch holiday tokens");
  return res.json() as Promise<AvailableHolidayTokenItem[]>;
}
