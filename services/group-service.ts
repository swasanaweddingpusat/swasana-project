import type { GroupsQueryResult, GroupWithPerformance } from "@/lib/queries/groups";

export interface GroupsPerformanceSummary {
  totalGroups: number;
  totalSales: number;
  totalTarget: number;
  avgAchievement: number;
  totalConfirmed: number;
  totalPiutang: number;
  totalRevenue: number;
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

export async function fetchGroupsPerformance(): Promise<GroupsPerformanceResponse> {
  const res = await fetch("/api/groups/performance");
  if (!res.ok) throw new Error("Failed to fetch groups performance");
  return res.json();
}

