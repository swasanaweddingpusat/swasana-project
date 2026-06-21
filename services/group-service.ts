import type { GroupsQueryResult, GroupWithPerformance, MemberAnnualTarget } from "@/lib/queries/groups";

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

export async function fetchGroupsPerformance(year?: number): Promise<GroupsPerformanceResponse> {
  const url = year ? `/api/groups/performance?year=${year}` : "/api/groups/performance";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch groups performance");
  return res.json();
}

export async function fetchMemberAnnualTargets(profileId: string): Promise<MemberAnnualTarget[]> {
  const res = await fetch(`/api/profiles/${profileId}/annual-targets`);
  if (!res.ok) throw new Error("Failed to fetch member annual targets");
  return res.json();
}

