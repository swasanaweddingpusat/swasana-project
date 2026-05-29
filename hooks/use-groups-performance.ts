"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsPerformance } from "@/services/group-service";

export function useGroupsPerformance(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["groups", "performance", startDate, endDate],
    queryFn: () => fetchGroupsPerformance(startDate, endDate),
    staleTime: 60_000,
  });
}
