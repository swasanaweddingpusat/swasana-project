"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardCalendarEventsResult } from "@/lib/queries/calendar-events";

async function fetchDashboardCalendarEvents(
  year: number,
  month: number,
): Promise<DashboardCalendarEventsResult> {
  const res = await fetch(`/api/dashboard-calendar-events?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard calendar events");
  return res.json();
}

export function useDashboardCalendarEvents(
  year: number,
  month: number,
  initialData?: DashboardCalendarEventsResult,
): ReturnType<typeof useQuery<DashboardCalendarEventsResult>> {
  return useQuery({
    queryKey: ["dashboard-calendar-events", year, month],
    queryFn: () => fetchDashboardCalendarEvents(year, month),
    initialData,
    refetchOnWindowFocus: false,
  });
}
