"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProcurementList,
  fetchProcurementById,
  createProcurement,
  updateProcurement,
  deleteProcurement,
  approveProcurement,
  approveProcurements,
  fetchProcurementSummary,
  exportProcurement,
  fetchAllPendingIds,
  fetchAnnouncementList,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchSummaryByVenue,
  fetchVenueBudgetList,
  createVenueBudget,
  updateVenueBudget,
  deleteVenueBudget,
} from "@/services/procurementService";
import type {
  ProcurementFilterInput,
  CreateProcurementInput,
  UpdateProcurementInput,
  ApproveProcurementInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  CreateVenueBudgetInput,
  UpdateVenueBudgetInput,
} from "@/lib/validations/procurement";

// ─── Procurement Items ────────────────────────────────────────────────────────

export function useProcurementList(params: Partial<ProcurementFilterInput> = {}) {
  return useQuery({
    queryKey: ["procurement", params] as const,
    queryFn: () => fetchProcurementList(params),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useProcurementById(id: string) {
  return useQuery({
    queryKey: ["procurement", id] as const,
    queryFn: () => fetchProcurementById(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useProcurementSummary(venueId?: string) {
  return useQuery({
    queryKey: ["procurement-summary", venueId] as const,
    queryFn: () => fetchProcurementSummary(venueId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateProcurement(): () => Promise<void> {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["procurement"] });
}

export function useCreateProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProcurementInput) => createProcurement(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });
}

export function useUpdateProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProcurementInput }) =>
      updateProcurement(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });
}

export function useDeleteProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProcurement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });
}

export function useApproveProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveProcurementInput }) =>
      approveProcurement(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });
}

export function useBulkApproveProcurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => approveProcurements(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement"] }),
  });
}

export function useExportProcurement() {
  return useMutation({
    mutationFn: (
      params: Partial<ProcurementFilterInput> & { format: "csv" | "excel" | "pdf" }
    ) => exportProcurement(params),
  });
}

export function useFetchAllPendingIds() {
  return useMutation({
    mutationFn: (params: Partial<Omit<ProcurementFilterInput, "page" | "limit">>) =>
      fetchAllPendingIds(params),
  });
}

// ─── Announcements ────────────────────────────────────────────────────────────

export function useAnnouncementList(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["procurement-announcements", page, limit] as const,
    queryFn: () => fetchAnnouncementList(page, limit),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnnouncementInput) => createAnnouncement(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-announcements"] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAnnouncementInput }) =>
      updateAnnouncement(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-announcements"] }),
  });
}

// ─── Summary by Venue ────────────────────────────────────────────────────────

export function useSummaryByVenue(period?: string) {
  return useQuery({
    queryKey: ["procurement-summary-venue", period] as const,
    queryFn: () => fetchSummaryByVenue(period),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// ─── Venue Budgets ───────────────────────────────────────────────────────────

export function useVenueBudgetList(period?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["procurement-budgets", period, page, limit] as const,
    queryFn: () => fetchVenueBudgetList(period, page, limit),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreateVenueBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVenueBudgetInput) => createVenueBudget(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-budgets"] }),
  });
}

export function useUpdateVenueBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVenueBudgetInput }) =>
      updateVenueBudget(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-budgets"] }),
  });
}

export function useDeleteVenueBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVenueBudget(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procurement-budgets"] }),
  });
}
