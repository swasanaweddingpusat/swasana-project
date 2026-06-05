"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MaintenanceTicketsResult, MaintenanceTicketItem, MaintenanceReportResult } from "@/lib/queries/maintenance";

interface MaintenanceFilter {
  type?: "TICKET" | "PREVENTIVE";
  search?: string;
  venueId?: string;
  brandId?: string;
  statusId?: string;
  priorityId?: string;
  categoryId?: string;
  assignedToId?: string;
  roleId?: string;
  isVendor?: string;
  isAudit?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

async function fetchMaintenanceTickets(filter: MaintenanceFilter): Promise<MaintenanceTicketsResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  const res = await fetch(`/api/maintenance?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch maintenance tickets");
  return res.json();
}

export function useMaintenance(filter: MaintenanceFilter = {}) {
  return useQuery({
    queryKey: ["maintenance", filter] as const,
    queryFn: () => fetchMaintenanceTickets(filter),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

async function createMaintenanceTicket(data: Record<string, unknown>): Promise<MaintenanceTicketItem> {
  const res = await fetch("/api/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat ticket");
  }
  return res.json();
}

async function updateMaintenanceTicket(id: string, data: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(`/api/maintenance/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate ticket");
  }
  return res.json();
}

async function deleteMaintenanceTicket(id: string): Promise<void> {
  const res = await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus ticket");
  }
}

export function useCreateMaintenance() {
  return useMutation({
    mutationFn: createMaintenanceTicket,
  });
}

export function useUpdateMaintenance() {
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      updateMaintenanceTicket(id, data),
  });
}

export function useInvalidateMaintenance(): () => Promise<void> {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["maintenance"] });
}

export function useDeleteMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMaintenanceTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
}

// ─── Report ──────────────────────────────────────────────────────────────────

interface ReportFilter {
  venueId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
}

async function fetchMaintenanceReport(filter: ReportFilter): Promise<MaintenanceReportResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  const res = await fetch(`/api/maintenance/report?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

export function useMaintenanceReport(filter: ReportFilter = {}) {
  return useQuery({
    queryKey: ["maintenance-report", filter] as const,
    queryFn: () => fetchMaintenanceReport(filter),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
