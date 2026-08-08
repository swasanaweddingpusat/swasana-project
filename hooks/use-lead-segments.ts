"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadSegmentItem } from "@/lib/queries/daily-activity";

async function fetchLeadSegments(): Promise<LeadSegmentItem[]> {
  const res = await fetch("/api/lead-segments");
  if (!res.ok) throw new Error("Failed to fetch lead segments");
  return res.json();
}

export function useLeadSegments() {
  return useQuery({
    queryKey: ["lead-segments"] as const,
    queryFn: fetchLeadSegments,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createLeadSegment(body: {
  name: string;
  isActive: boolean;
  sortOrder: number;
}): Promise<LeadSegmentItem> {
  const res = await fetch("/api/lead-segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat segment");
  }
  return res.json();
}

async function updateLeadSegment(id: string, body: Partial<{
  name: string;
  isActive: boolean;
  sortOrder: number;
}>): Promise<LeadSegmentItem> {
  const res = await fetch(`/api/lead-segments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate segment");
  }
  return res.json();
}

async function deleteLeadSegment(id: string): Promise<void> {
  const res = await fetch(`/api/lead-segments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus segment");
  }
}

export function useCreateLeadSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLeadSegment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-segments"] }),
  });
}

export function useUpdateLeadSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateLeadSegment>[1]) =>
      updateLeadSegment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-segments"] }),
  });
}

export function useDeleteLeadSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLeadSegment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-segments"] }),
  });
}
