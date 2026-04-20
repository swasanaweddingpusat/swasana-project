import type { UserQueryItem } from "@/lib/queries/users";

export async function fetchUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function fetchUserById(id: string): Promise<UserQueryItem> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user ${id}`);
  return res.json();
}
