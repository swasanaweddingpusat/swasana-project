import type { UsersQueryResult, UserQueryItem } from "@/lib/queries/users";
import type { UserFilters } from "@/types/user";

export async function fetchUsers(filters: UserFilters = {}): Promise<UsersQueryResult> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.roleId) params.set("roleId", filters.roleId);
  if (filters.status) params.set("status", filters.status);
  if (filters.venueId) params.set("venueId", filters.venueId);
  if (filters.dataScope) params.set("dataScope", filters.dataScope);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const url = params.size > 0 ? `/api/users?${params}` : "/api/users";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function fetchUserById(id: string): Promise<UserQueryItem> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user ${id}`);
  return res.json();
}
