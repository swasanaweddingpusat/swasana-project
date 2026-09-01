"use client";

import { useQuery } from "@tanstack/react-query";
import type { SalesPerformanceCardItem } from "@/lib/queries/salesPerformance";

async function fetchDashboardSalesPerformance(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
): Promise<SalesPerformanceCardItem[]> {
  // Empty day-strings mean "no filter" — omit them so the route returns
  // all-time totals (sending `?dealFrom=` fails the YYYY-MM-DD regex).
  const qs = new URLSearchParams();
  if (dealFrom) qs.set("dealFrom", dealFrom);
  if (dealTo) qs.set("dealTo", dealTo);
  if (eventFrom) qs.set("eventFrom", eventFrom);
  if (eventTo) qs.set("eventTo", eventTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/dashboard/sales-performance${suffix}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard sales performance");
  return res.json() as Promise<SalesPerformanceCardItem[]>;
}

export function useDashboardSalesPerformance(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
  initialData?: SalesPerformanceCardItem[],
) {
  return useQuery({
    queryKey: ["dashboard-sales-performance", dealFrom, dealTo, eventFrom, eventTo],
    queryFn: () => fetchDashboardSalesPerformance(dealFrom, dealTo, eventFrom, eventTo),
    initialData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
