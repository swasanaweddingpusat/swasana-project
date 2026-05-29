"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createLead, updateLead, deleteLead, updateLeadStatus } from "@/actions/lead";
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from "@/lib/validations/lead";
import type { LeadsResult } from "@/lib/queries/leads";

interface LeadFilter {
  search?: string;
  category?: string;
  statusId?: string;
  venueId?: string;
  page?: number;
  pageSize?: number;
}

async function fetchLeads(filter: LeadFilter = {}): Promise<LeadsResult> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.category && filter.category !== "all") params.set("category", filter.category);
  if (filter.statusId) params.set("statusId", filter.statusId);
  if (filter.venueId) params.set("venueId", filter.venueId);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
