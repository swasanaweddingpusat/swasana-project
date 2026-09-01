"use client";

import { useQuery } from "@tanstack/react-query";
import type { GroupAchievementData } from "@/lib/queries/dashboard";

async function fetchDashboardGroups(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
): Promise<GroupAchievementData[]> {
  // Empty day-strings mean "no filter" — omit them so the route returns
  // all-time totals (sending `?dealFrom=` fails the YYYY-MM-DD regex).
  const qs = new URLSearchParams();
  if (dealFrom) qs.set("dealFrom", dealFrom);
  if (dealTo) qs.set("dealTo", dealTo);
  if (eventFrom) qs.set("eventFrom", eventFrom);
  if (eventTo) qs.set("eventTo", eventTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/dashboard/groups${suffix}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard groups");
  return res.json() as Promise<GroupAchievementData[]>;
}

export function useDashboardGroups(
  dealFrom: string,
  dealTo: string,
  eventFrom: string,
  eventTo: string,
  initialData?: GroupAchievementData[],
) {
  return useQuery({
    queryKey: ["dashboard-groups", dealFrom, dealTo, eventFrom, eventTo],
    queryFn: () => fetchDashboardGroups(dealFrom, dealTo, eventFrom, eventTo),
    initialData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}
