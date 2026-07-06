"use client";

import { useQuery } from "@tanstack/react-query";
import type { SalesPerformanceItem } from "@/lib/queries/dashboard";

async function fetchDashboardLeaderboard(
  year: number,
  month: number,
): Promise<SalesPerformanceItem[]> {
  const res = await fetch(`/api/dashboard/leaderboard?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard leaderboard");
  return res.json() as Promise<SalesPerformanceItem[]>;
}

export function useDashboardLeaderboard(
  year: number,
  month: number,
  initialData?: SalesPerformanceItem[],
) {
  return useQuery({
    queryKey: ["dashboard-leaderboard", year, month],
    queryFn: () => fetchDashboardLeaderboard(year, month),
    initialData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
