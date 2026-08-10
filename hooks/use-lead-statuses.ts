"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadStatusItem } from "@/lib/queries/daily-activity";

async function fetchLeadStatuses(): Promise<LeadStatusItem[]> {
  const res = await fetch("/api/lead-statuses");
  if (!res.ok) throw new Error("Failed to fetch lead statuses");
  return res.json();
}

export function useLeadStatuses() {
  return useQuery({
    queryKey: ["lead-statuses"] as const,
    queryFn: fetchLeadStatuses,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createLeadStatus(body: {
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
}): Promise<LeadStatusItem> {
  const res = await fetch("/api/lead-statuses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat status");
  }
  return res.json();
}

async function updateLeadStatus(id: string, body: Partial<{
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
}>): Promise<LeadStatusItem> {
  const res = await fetch(`/api/lead-statuses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate status");
  }
  return res.json();
}

async function deleteLeadStatus(id: string): Promise<void> {
  const res = await fetch(`/api/lead-statuses/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus status");
  }
}

export function useCreateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLeadStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateLeadStatus>[1]) =>
      updateLeadStatus(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}

export function useDeleteLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLeadStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-statuses"] }),
  });
}
