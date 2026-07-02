"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/queries/dashboard";

async function fetchDashboardStats(
  year: number,
  month: number,
): Promise<DashboardStats> {
  const res = await fetch(`/api/dashboard/stats?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json() as Promise<DashboardStats>;
}

export function useDashboardStats(
  year: number,
  month: number, // 1-indexed (January = 1)
  initialData?: DashboardStats,
) {
  return useQuery({
    queryKey: ["dashboard-stats", year, month],
    queryFn: () => fetchDashboardStats(year, month),
    initialData,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });
}
