import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";

export async function fetchGuestbookEntries(): Promise<GuestbookEntryItem[]> {
  const res = await fetch("/api/guestbook");
  if (!res.ok) throw new Error("Failed to fetch guestbook entries");
  return res.json() as Promise<GuestbookEntryItem[]>;
}
