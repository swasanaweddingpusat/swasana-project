import { WeddingIndicatorFilters } from "@/lib/validations/weddingIndicator";

export async function fetchWeddingIndicators(filters: WeddingIndicatorFilters) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());
  if (filters.search) params.set("search", filters.search);
  if (filters.venueId) params.set("venueId", filters.venueId);
  if (filters.dateFrom)
    params.set("dateFrom", filters.dateFrom.toISOString());
  if (filters.dateTo) params.set("dateTo", filters.dateTo.toISOString());

  const res = await fetch(`/api/wedding-indicators?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch wedding indicators");
  return res.json();
}

export async function fetchWeddingIndicatorById(id: string) {
  const res = await fetch(`/api/wedding-indicators/${id}`);
  if (!res.ok) throw new Error("Failed to fetch wedding indicator");
  return res.json();
}
