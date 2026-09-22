import type { BonusItem } from "@/lib/queries/bonus";

export interface BonusListResult {
  data: BonusItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchBonuses(
  params: { search?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}
): Promise<BonusListResult> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.activeOnly === false) sp.set("activeOnly", "false");
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/bonuses?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch bonuses (${res.status})`);
  return res.json() as Promise<BonusListResult>;
}
