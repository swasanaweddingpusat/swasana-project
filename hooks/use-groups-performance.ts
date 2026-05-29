"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsPerformance } from "@/services/group-service";

export function useGroupsPerformance() {
  return useQuery({
    queryKey: ["groups", "performance"],
    queryFn: () => fetchGroupsPerformance(),
    staleTime: 60_000,
  });
}
