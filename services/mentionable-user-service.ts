import type { MentionableUser } from "@/lib/queries/users";

export async function fetchMentionableUsers(): Promise<MentionableUser[]> {
  const res = await fetch("/api/users/mentionable");
  if (!res.ok) throw new Error("Failed to fetch mentionable users");
  return res.json();
}
