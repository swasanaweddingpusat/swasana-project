import type { ShiftOverrideItem } from "@/lib/queries/shiftOverrides";

export async function fetchShiftOverrides(params?: {
  profileId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ShiftOverrideItem[]> {
  const url = new URL("/api/hr/shift-overrides", window.location.origin);
  if (params?.profileId) url.searchParams.set("profileId", params.profileId);
  if (params?.startDate) url.searchParams.set("startDate", params.startDate);
  if (params?.endDate) url.searchParams.set("endDate", params.endDate);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch shift overrides");
  return res.json() as Promise<ShiftOverrideItem[]>;
}
