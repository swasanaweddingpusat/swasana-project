"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsPerformance } from "@/services/group-service";
import type { GroupPerformanceItem } from "@/lib/queries/groups";

export function useGroupsPerformance() {
  return useQuery({
    queryKey: ["groups", "performance"],
    queryFn: () => fetchGroupsPerformance(),
    staleTime: 60_000,
  });
}

export function useGroupPerformance(
  groupId: string,
  initialData?: GroupPerformanceItem[],
) {
  return useQuery<GroupPerformanceItem[]>({
    queryKey: ["groups", "performance", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/performance`);
      if (!res.ok) return initialData ?? [];
      return res.json() as Promise<GroupPerformanceItem[]>;
    },
    initialData,
    staleTime: 60_000,
    enabled: !!groupId,
  });
}
