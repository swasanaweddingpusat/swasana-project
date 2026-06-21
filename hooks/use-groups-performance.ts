"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsPerformance, fetchMemberAnnualTargets } from "@/services/group-service";
import type { GroupPerformanceItem, MemberAnnualTarget } from "@/lib/queries/groups";

export function useGroupsPerformance(year?: number) {
  return useQuery({
    queryKey: ["groups", "performance", year ?? "default"],
    queryFn: () => fetchGroupsPerformance(year),
    staleTime: 60_000,
  });
}

export function useGroupPerformance(
  groupId: string,
  initialData?: GroupPerformanceItem[],
  year?: number,
) {
  return useQuery<GroupPerformanceItem[]>({
    queryKey: ["groups", "performance", groupId, year ?? "default"],
    queryFn: async () => {
      const url = year
        ? `/api/groups/${groupId}/performance?year=${year}`
        : `/api/groups/${groupId}/performance`;
      const res = await fetch(url);
      if (!res.ok) return initialData ?? [];
      return res.json() as Promise<GroupPerformanceItem[]>;
    },
    initialData,
    staleTime: 60_000,
    enabled: !!groupId,
  });
}

export function useMemberAnnualTargets(profileId: string | null) {
  return useQuery<MemberAnnualTarget[]>({
    queryKey: ["member-annual-targets", profileId],
    queryFn: () => fetchMemberAnnualTargets(profileId!),
    staleTime: 60_000,
    enabled: !!profileId,
  });
}
