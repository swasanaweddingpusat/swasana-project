"use client";

import { useQuery } from "@tanstack/react-query";
import type { GroupAchievementData } from "@/lib/queries/dashboard";

async function fetchDashboardGroups(
  year: number,
  month: number,
): Promise<GroupAchievementData[]> {
  const res = await fetch(`/api/dashboard/groups?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard groups");
  return res.json() as Promise<GroupAchievementData[]>;
}

export function useDashboardGroups(
  year: number,
  month: number,
  initialData?: GroupAchievementData[],
) {
  return useQuery({
    queryKey: ["dashboard-groups", year, month],
    queryFn: () => fetchDashboardGroups(year, month),
    initialData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
