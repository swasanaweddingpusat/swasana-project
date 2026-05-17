import type { GroupsQueryResult, GroupQueryItem, GroupWithPerformance } from "@/lib/queries/groups";

export interface GroupsPerformanceSummary {
  totalGroups: number;
  totalSales: number;
  avgAchievement: number;
  totalConfirmed: number;
}

export interface GroupsPerformanceResponse {
  summary: GroupsPerformanceSummary;
  groups: GroupWithPerformance[];
}

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

export async function fetchGroupsPerformance(
  startDate: string,
  endDate: string,
): Promise<GroupsPerformanceResponse> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/groups/performance?${params}`);
  if (!res.ok) throw new Error("Failed to fetch groups performance");
  return res.json();
}
