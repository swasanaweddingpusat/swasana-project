"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaintenanceCategoryItem } from "@/lib/queries/maintenance";

async function fetchMaintenanceCategories(): Promise<MaintenanceCategoryItem[]> {
  const res = await fetch("/api/maintenance-categories");
  if (!res.ok) throw new Error("Failed to fetch maintenance categories");
  return res.json();
}

export function useMaintenanceCategories() {
  return useQuery({
    queryKey: ["maintenance-categories"] as const,
    queryFn: fetchMaintenanceCategories,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createMaintenanceCategory(body: { name: string }): Promise<MaintenanceCategoryItem> {
  const res = await fetch("/api/maintenance-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat kategori");
  }
  return res.json();
}

async function updateMaintenanceCategory(id: string, body: Partial<{ name: string }>): Promise<MaintenanceCategoryItem> {
  const res = await fetch(`/api/maintenance-categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate kategori");
  }
  return res.json();
}

async function deleteMaintenanceCategory(id: string): Promise<void> {
  const res = await fetch(`/api/maintenance-categories/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus kategori");
  }
}

export function useCreateMaintenanceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMaintenanceCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-categories"] }),
  });
}

export function useUpdateMaintenanceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateMaintenanceCategory>[1]) =>
      updateMaintenanceCategory(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-categories"] }),
  });
}

export function useDeleteMaintenanceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMaintenanceCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-categories"] }),
  });
}
