import type { PaginatedGuestbookEntries, GuestbookFilterOptions } from "@/lib/queries/guestbookEntries";

export async function fetchGuestbookEntries(
  params?: GuestbookFilterOptions & { page?: number; pageSize?: number }
): Promise<PaginatedGuestbookEntries> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.venueId) searchParams.set("venueId", params.venueId);
  if (params?.hostId) searchParams.set("hostId", params.hostId);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.interactionType) searchParams.set("interactionType", params.interactionType);
  const qs = searchParams.toString();

  const res = await fetch(`/api/guestbook${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch guestbook entries");
  return res.json() as Promise<PaginatedGuestbookEntries>;
}
