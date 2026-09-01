import type { VendorCategoriesResult, VendorCategoriesLiteResult, VendorsResult } from "@/lib/queries/vendors";

export async function fetchVendorCategories(): Promise<VendorCategoriesResult> {
  const res = await fetch("/api/vendors");
  if (!res.ok) throw new Error("Failed to fetch vendors");
  return res.json();
}

export async function fetchVendorCategoriesLite(): Promise<VendorCategoriesLiteResult> {
  const res = await fetch("/api/vendors/categories");
  if (!res.ok) throw new Error("Failed to fetch vendor categories");
  return res.json();
}

interface FetchVendorsParams {
  page: number;
  pageSize: number;
  search: string;
  categoryId: string;
}

export async function fetchVendors(params: FetchVendorsParams): Promise<VendorsResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.categoryId && params.categoryId !== "all" ? { categoryId: params.categoryId } : {}),
  });
  const res = await fetch(`/api/vendors/list?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch vendors");
  return res.json();
}
