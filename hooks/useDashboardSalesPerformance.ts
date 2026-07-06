"use client";

import { useQuery } from "@tanstack/react-query";
import type { SalesPerformanceCardItem } from "@/lib/queries/salesPerformance";

async function fetchDashboardSalesPerformance(
  year: number,
  month: number,
): Promise<SalesPerformanceCardItem[]> {
  const res = await fetch(`/api/dashboard/sales-performance?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard sales performance");
  return res.json() as Promise<SalesPerformanceCardItem[]>;
}

export function useDashboardSalesPerformance(
  year: number,
  month: number,
  initialData?: SalesPerformanceCardItem[],
) {
  return useQuery({
    queryKey: ["dashboard-sales-performance", year, month],
    queryFn: () => fetchDashboardSalesPerformance(year, month),
    initialData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
