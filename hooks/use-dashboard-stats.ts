"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/queries/dashboard";

async function fetchDashboardStats(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
): Promise<DashboardStats> {
  // Empty day-strings mean "no filter" — omit them so the route sees no params
  // and returns all-time totals (sending `?dealFrom=` fails the YYYY-MM-DD regex).
  const qs = new URLSearchParams();
  if (dealFrom) qs.set("dealFrom", dealFrom);
  if (dealTo) qs.set("dealTo", dealTo);
  if (eventFrom) qs.set("eventFrom", eventFrom);
  if (eventTo) qs.set("eventTo", eventTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/dashboard/stats${suffix}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json() as Promise<DashboardStats>;
}

export function useDashboardStats(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
  initialData?: DashboardStats,
) {
  return useQuery({
    queryKey: ["dashboard-stats", dealFrom, dealTo, eventFrom, eventTo],
    queryFn: () => fetchDashboardStats(dealFrom, dealTo, eventFrom, eventTo),
    initialData,
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });
}
