import type { GroupsQueryResult, GroupQueryItem, GroupWithPerformance, SalesBookingItem } from "@/lib/queries/groups";

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

export async function fetchGroupById(id: string): Promise<GroupQueryItem> {
  const res = await fetch(`/api/groups/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch group ${id}`);
  return res.json();
}

export async function fetchGroupsPerformance(): Promise<GroupsPerformanceResponse> {
  const res = await fetch("/api/groups/performance");
  if (!res.ok) throw new Error("Failed to fetch groups performance");
  return res.json();
}

export async function fetchSalesBookings(
  salesId: string,
  take = 5,
  skip = 0,
): Promise<SalesBookingItem[]> {
  const params = new URLSearchParams({
    salesId,
    take: take.toString(),
    skip: skip.toString(),
  });
  const res = await fetch(`/api/sales-bookings?${params}`);
  if (!res.ok) throw new Error("Failed to fetch sales bookings");
  return res.json();
}
