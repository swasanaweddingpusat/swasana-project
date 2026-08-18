import type { AnnouncementItem } from "@/lib/queries/announcements";

export async function fetchAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await fetch("/api/announcements");
  if (!res.ok) throw new Error("Failed to fetch announcements");
  return res.json() as Promise<AnnouncementItem[]>;
}
