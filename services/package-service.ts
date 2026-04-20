import type { PackagesQueryResult } from "@/lib/queries/packages";

export async function fetchPackages(venueId?: string): Promise<PackagesQueryResult> {
  const params = venueId ? `?venueId=${venueId}` : "";
  const res = await fetch(`/api/packages${params}`);
  if (!res.ok) throw new Error("Failed to fetch packages");
  return res.json();
}
