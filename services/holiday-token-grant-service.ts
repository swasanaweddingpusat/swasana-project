import type { HolidayTokenGrantsResult } from "@/lib/queries/publicHoliday";

export async function fetchHolidayTokenGrants(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<HolidayTokenGrantsResult> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.search) sp.set("search", params.search);
  const res = await fetch(`/api/hr/holiday-token-grants?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch holiday token grants");
  return res.json() as Promise<HolidayTokenGrantsResult>;
}
