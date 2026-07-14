"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPerformanceReviews, fetchKpis } from "@/services/hr-performance-service";
import {
  createPerformanceReview,
  updatePerformanceReview,
  deletePerformanceReview,
  createKpi,
  updateKpi,
  deleteKpi,
} from "@/actions/hrPerformance";

// ─── Performance Reviews ──────────────────────────────────────────────────────

export function usePerformanceReviews() {
  return useQuery({
    queryKey: ["performance-reviews"],
    queryFn: fetchPerformanceReviews,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPerformanceReview>[0]) =>
      createPerformanceReview(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance-reviews"] }),
  });
}

export function useUpdatePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updatePerformanceReview>[1];
    }) => updatePerformanceReview(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance-reviews"] }),
  });
}

export function useDeletePerformanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePerformanceReview(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance-reviews"] }),
  });
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export function useKpis() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: fetchKpis,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createKpi>[0]) => createKpi(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpis"] }),
  });
}

export function useUpdateKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateKpi>[1];
    }) => updateKpi(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpis"] }),
  });
}

export function useDeleteKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteKpi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpis"] }),
  });
}
