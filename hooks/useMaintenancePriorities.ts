"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaintenancePriorityItem } from "@/lib/queries/maintenance";

async function fetchMaintenancePriorities(): Promise<MaintenancePriorityItem[]> {
  const res = await fetch("/api/maintenance-priorities");
  if (!res.ok) throw new Error("Failed to fetch maintenance priorities");
  return res.json();
}

export function useMaintenancePriorities() {
  return useQuery({
    queryKey: ["maintenance-priorities"] as const,
    queryFn: fetchMaintenancePriorities,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createMaintenancePriority(body: { name: string; deadlineDays: number }): Promise<MaintenancePriorityItem> {
  const res = await fetch("/api/maintenance-priorities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat prioritas");
  }
  return res.json();
}

async function updateMaintenancePriority(id: string, body: Partial<{ name: string; deadlineDays: number }>): Promise<MaintenancePriorityItem> {
  const res = await fetch(`/api/maintenance-priorities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate prioritas");
  }
  return res.json();
}

async function deleteMaintenancePriority(id: string): Promise<void> {
  const res = await fetch(`/api/maintenance-priorities/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus prioritas");
  }
}

export function useCreateMaintenancePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMaintenancePriority,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-priorities"] }),
  });
}

export function useUpdateMaintenancePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateMaintenancePriority>[1]) =>
      updateMaintenancePriority(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-priorities"] }),
  });
}

export function useDeleteMaintenancePriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMaintenancePriority,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-priorities"] }),
  });
}
