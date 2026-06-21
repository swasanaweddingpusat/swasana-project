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

const CURRENT_YEAR = new Date().getFullYear();

export function useGroupPerformance(
  groupId: string,
  initialData?: GroupPerformanceItem[],
  year?: number,
) {
  // initialData comes from the server component and is always for the current year.
  // Only inject it when the selected year matches, so switching to a different year
  // always triggers a real fetch instead of reusing server-rendered data.
  const resolvedYear = year ?? CURRENT_YEAR;
  const safeInitialData = resolvedYear === CURRENT_YEAR ? initialData : undefined;

  return useQuery<GroupPerformanceItem[]>({
    queryKey: ["groups", "performance", groupId, resolvedYear],
    queryFn: async () => {
      const url = `/api/groups/${groupId}/performance?year=${resolvedYear}`;
      const res = await fetch(url);
      if (!res.ok) return safeInitialData ?? [];
      return res.json() as Promise<GroupPerformanceItem[]>;
    },
    initialData: safeInitialData,
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
