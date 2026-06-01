import type { AssignableSalesUser } from "@/lib/queries/users";

export async function fetchAssignableSalesUsers(): Promise<AssignableSalesUser[]> {
  const res = await fetch("/api/users/sales");
  if (!res.ok) throw new Error("Failed to fetch sales users");
  return res.json();
}
