"use client";

import { useQuery } from "@tanstack/react-query";
import type { CalendarEventsResult } from "@/lib/queries/calendar-events";

async function fetchCalendarEvents(year: number, month: number): Promise<CalendarEventsResult> {
  const res = await fetch(`/api/calendar-events?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Failed to fetch calendar events");
  return res.json();
}

export function useCalendarEvents(year: number, month: number, initialData?: CalendarEventsResult) {
  return useQuery({
    queryKey: ["calendar-events", year, month],
    queryFn: () => fetchCalendarEvents(year, month),
    initialData,
    refetchOnWindowFocus: false,
  });
}
