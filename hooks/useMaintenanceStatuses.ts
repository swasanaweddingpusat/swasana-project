"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaintenanceStatusItem } from "@/lib/queries/maintenance";

async function fetchMaintenanceStatuses(): Promise<MaintenanceStatusItem[]> {
  const res = await fetch("/api/maintenance-statuses");
  if (!res.ok) throw new Error("Failed to fetch maintenance statuses");
  return res.json();
}

export function useMaintenanceStatuses() {
  return useQuery({
    queryKey: ["maintenance-statuses"] as const,
    queryFn: fetchMaintenanceStatuses,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createMaintenanceStatus(body: { name: string; order: number }): Promise<MaintenanceStatusItem> {
  const res = await fetch("/api/maintenance-statuses", {
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

async function updateMaintenanceStatus(id: string, body: Partial<{ name: string; order: number }>): Promise<MaintenanceStatusItem> {
  const res = await fetch(`/api/maintenance-statuses/${id}`, {
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

async function deleteMaintenanceStatus(id: string): Promise<void> {
  const res = await fetch(`/api/maintenance-statuses/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus status");
  }
}

export function useCreateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMaintenanceStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-statuses"] }),
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateMaintenanceStatus>[1]) =>
      updateMaintenanceStatus(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-statuses"] }),
  });
}

export function useDeleteMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMaintenanceStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-statuses"] }),
  });
}
