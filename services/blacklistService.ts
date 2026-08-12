import type { BlacklistEntryItem } from "@/lib/queries/blacklistEntries";

export async function fetchBlacklistEntries(): Promise<BlacklistEntryItem[]> {
  const res = await fetch("/api/hr/blacklist-entries");
  if (!res.ok) throw new Error("Failed to fetch blacklist entries");
  return res.json() as Promise<BlacklistEntryItem[]>;
}
