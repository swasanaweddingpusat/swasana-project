import type { PackagesQueryResult } from "@/lib/queries/packages";

export interface FetchPackagesParams {
  venueId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function fetchPackages(params: FetchPackagesParams = {}): Promise<PackagesQueryResult> {
  const qs = new URLSearchParams();
  if (params.venueId) qs.set("venueId", params.venueId);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  const res = await fetch(`/api/packages${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}
