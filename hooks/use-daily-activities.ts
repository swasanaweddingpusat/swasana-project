"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createDailyActivity, updateDailyActivity, deleteDailyActivity, updateDailyActivityStatus } from "@/actions/daily-activity";
import type { CreateDailyActivityInput, UpdateDailyActivityInput, UpdateDailyActivityStatusInput, DailyActivityScope } from "@/lib/validations/daily-activity";
import type { DailyActivitiesResult, LeadStatusItem } from "@/lib/queries/daily-activity";

// Re-export so consumers can import from here without touching the validation schema directly
export type { DailyActivityScope };

interface DailyActivityFilter {
  search?: string;
  scope?: DailyActivityScope;
  statusId?: string;
  venueId?: string;
  eventTypeId?: string;
  segmentId?: string;
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}

async function fetchDailyActivities(filter: DailyActivityFilter = {}): Promise<DailyActivitiesResult> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.scope) params.set("scope", filter.scope);
  if (filter.statusId) params.set("statusId", filter.statusId);
  if (filter.venueId) params.set("venueId", filter.venueId);
  if (filter.eventTypeId) params.set("eventTypeId", filter.eventTypeId);
  if (filter.segmentId) params.set("segmentId", filter.segmentId);
  if (filter.assignedToId) params.set("assignedToId", filter.assignedToId);
  if (filter.page) params.set("page", String(filter.page));
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize));

  const res = await fetch(`/api/daily-activity?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch daily activities");
  return res.json();
}

export function useDailyActivities(filter: DailyActivityFilter = {}) {
  return useQuery({
    queryKey: ["daily-activity", filter] as const,
    queryFn: () => fetchDailyActivities(filter),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDailyActivityInput) => createDailyActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activity"] }),
  });
}

export function useUpdateDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDailyActivityInput) => updateDailyActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activity"] }),
  });
}

export function useDeleteDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDailyActivity(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activity"] }),
  });
}

export function useUpdateDailyActivityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDailyActivityStatusInput) => updateDailyActivityStatus(data),
    // Optimistic: move the card immediately, before the API responds.
    onMutate: async ({ id, statusId }) => {
      await qc.cancelQueries({ queryKey: ["daily-activity"] });

      // Resolve the target status object from the cached statuses list.
      const statuses = qc.getQueryData<LeadStatusItem[]>(["lead-statuses"]);
      const nextStatus = statuses?.find((s) => s.id === statusId);
      if (!nextStatus) return { snapshots: [] as [readonly unknown[], DailyActivitiesResult | undefined][] };

      // Snapshot every cached daily-activity query so we can roll back on error.
      const snapshots = qc.getQueriesData<DailyActivitiesResult>({ queryKey: ["daily-activity"] });

      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<DailyActivitiesResult>(key, {
          ...data,
          items: data.items.map((lead) =>
            lead.id === id
              ? {
                  ...lead,
                  status: {
                    id: nextStatus.id,
                    name: nextStatus.name,
                    color: nextStatus.color,
                    isFinal: nextStatus.isFinal,
                    isSystem: nextStatus.isSystem,
                  },
                }
              : lead,
          ),
        });
      }

      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the pre-drag snapshots.
      context?.snapshots?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["daily-activity"] }),
  });
}
