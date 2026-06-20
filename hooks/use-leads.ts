"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createLead, updateLead, deleteLead, updateLeadStatus } from "@/actions/lead";
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStatusInput, LeadScope } from "@/lib/validations/lead";
import type { LeadsResult, LeadStatusItem } from "@/lib/queries/leads";

// Re-export so consumers can import from here without touching the validation schema directly
export type { LeadScope };

interface LeadFilter {
  search?: string;
  /** Scope of leads to fetch. "deleted" = soft-deleted (trash) view — requires leads:view-soft-delete on server. */
  scope?: LeadScope;
  statusId?: string;
  venueId?: string;
  eventTypeId?: string;
  assignedToId?: string;
  page?: number;
  pageSize?: number;
}

async function fetchLeads(filter: LeadFilter = {}): Promise<LeadsResult> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.scope) params.set("scope", filter.scope);
  if (filter.statusId) params.set("statusId", filter.statusId);
  if (filter.venueId) params.set("venueId", filter.venueId);
  if (filter.eventTypeId) params.set("eventTypeId", filter.eventTypeId);
  if (filter.assignedToId) params.set("assignedToId", filter.assignedToId);
  if (filter.page) params.set("page", String(filter.page));
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize));

  const res = await fetch(`/api/leads?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch leads");
  return res.json();
}

export function useLeads(filter: LeadFilter = {}) {
  return useQuery({
    queryKey: ["leads", filter] as const,
    queryFn: () => fetchLeads(filter),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadInput) => createLead(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLeadInput) => updateLead(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLeadStatusInput) => updateLeadStatus(data),
    // Optimistic: move the card immediately, before the API responds.
    onMutate: async ({ id, statusId }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });

      // Resolve the target status object from the cached statuses list.
      const statuses = qc.getQueryData<LeadStatusItem[]>(["lead-statuses"]);
      const nextStatus = statuses?.find((s) => s.id === statusId);
      if (!nextStatus) return { snapshots: [] as [readonly unknown[], LeadsResult | undefined][] };

      // Snapshot every cached leads query so we can roll back on error.
      const snapshots = qc.getQueriesData<LeadsResult>({ queryKey: ["leads"] });

      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<LeadsResult>(key, {
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
