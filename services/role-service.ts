import type { RolesQueryResult } from "@/lib/queries/roles";

export async function fetchRoles(): Promise<RolesQueryResult> {
  const res = await fetch("/api/roles");
  if (!res.ok) throw new Error("Failed to fetch roles");
  return res.json();
}
