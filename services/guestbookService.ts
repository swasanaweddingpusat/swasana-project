import type { PaginatedGuestbookEntries } from "@/lib/queries/guestbookEntries";

export async function fetchGuestbookEntries(
  params?: { page?: number; pageSize?: number }
): Promise<PaginatedGuestbookEntries> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  const qs = searchParams.toString();

  const res = await fetch(`/api/guestbook${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch guestbook entries");
  return res.json() as Promise<PaginatedGuestbookEntries>;
}
