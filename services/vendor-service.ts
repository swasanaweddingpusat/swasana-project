import type { VendorCategoriesResult } from "@/lib/queries/vendors";

export async function fetchVendorCategories(): Promise<VendorCategoriesResult> {
  const res = await fetch("/api/vendors");
  if (!res.ok) throw new Error("Failed to fetch vendors");
  return res.json();
}
