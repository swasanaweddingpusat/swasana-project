"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicHolidaysResult } from "@/lib/queries/publicHoliday";

async function fetchPublicHolidays(): Promise<PublicHolidaysResult> {
  const res = await fetch("/api/public-holiday");
  if (!res.ok) throw new Error("Failed to fetch public holidays");
  return res.json();
}

export function usePublicHolidays() {
  return useQuery<PublicHolidaysResult>({
    queryKey: ["public-holidays"] as const,
    queryFn: fetchPublicHolidays,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
