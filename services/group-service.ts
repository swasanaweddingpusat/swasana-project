import type { GroupsQueryResult, GroupQueryItem } from "@/lib/queries/groups";

export async function fetchGroups(): Promise<GroupsQueryResult> {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

export async function fetchGroupById(id: string): Promise<GroupQueryItem> {
  const res = await fetch(`/api/groups/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch group ${id}`);
  return res.json();
}
