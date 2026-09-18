"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  createTargetItem,
  updateTargetItem,
  deleteTargetItem,
  createAchievementSchema,
  upsertSchemaWithTiers,
  deleteAchievementSchema,
  createKpiMaster,
  updateKpiMaster,
  deleteKpiMaster,
} from "@/actions/kpiInsentif";
import type {
  TargetItemRow,
  AchievementSchemaRow,
  KpiMasterRow,
} from "@/lib/queries/kpiInsentif";
import {
  fetchKpiAssignments,
  fetchKpiResults,
  fetchProfilesForAssignment,
  type AssignmentFilters,
  type ResultFilters,
} from "@/services/kpiInsentifService";

// ─── Target Items ─────────────────────────────────────────────────────────────

export function useTargetItems() {
  return useQuery<TargetItemRow[]>({
    queryKey: ["kpi-insentif", "target-items"],
    queryFn: async () => {
      const res = await fetch("/api/kpi-insentif/target-items");
      if (!res.ok) throw new Error(`Gagal mengambil target items (${res.status})`);
      return res.json() as Promise<TargetItemRow[]>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateTargetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createTargetItem>[0]) => createTargetItem(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useUpdateTargetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTargetItem>[1] }) =>
      updateTargetItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useDeleteTargetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTargetItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

// ─── Achievement Schemas ──────────────────────────────────────────────────────

export function useAchievementSchemas(businessRole?: string) {
  return useQuery<AchievementSchemaRow[]>({
    queryKey: ["kpi-insentif", "achievement-schemas", businessRole ?? "all"],
    queryFn: async () => {
      const params = businessRole ? `?businessRole=${businessRole}` : "";
      const res = await fetch(`/api/kpi-insentif/achievement-schemas${params}`);
      if (!res.ok) throw new Error(`Gagal mengambil skema achievement (${res.status})`);
      return res.json() as Promise<AchievementSchemaRow[]>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpsertSchemaWithTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof upsertSchemaWithTiers>[0]) => upsertSchemaWithTiers(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useCreateAchievementSchema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createAchievementSchema>[0]) =>
      createAchievementSchema(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useDeleteAchievementSchema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAchievementSchema(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

// ─── KPI Masters ──────────────────────────────────────────────────────────────

export function useKpiMasters(filters?: { businessRole?: string; month?: Date }) {
  return useQuery<KpiMasterRow[]>({
    queryKey: [
      "kpi-insentif",
      "kpi-masters",
      filters?.businessRole ?? "all",
      filters?.month?.toISOString() ?? "",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.businessRole) params.set("businessRole", filters.businessRole);
      if (filters?.month) {
        const d = filters.month;
        params.set("month", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const qs = params.toString();
      const res = await fetch(`/api/kpi-insentif/kpi-masters${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`Gagal mengambil KPI master (${res.status})`);
      return res.json() as Promise<KpiMasterRow[]>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateKpiMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createKpiMaster>[0]) => createKpiMaster(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useUpdateKpiMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateKpiMaster>[1] }) =>
      updateKpiMaster(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useDeleteKpiMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteKpiMaster(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export function useAssignments(filters?: AssignmentFilters) {
  return useQuery({
    queryKey: [
      "kpi-insentif",
      "assignments",
      filters?.profileId,
      filters?.period,
      filters?.kpiMasterId,
      filters?.venueId,
      filters?.isDraft,
    ],
    queryFn: () => fetchKpiAssignments(filters),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { createAssignment } = await import("@/actions/kpiInsentif");
      return createAssignment(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { updateAssignment } = await import("@/actions/kpiInsentif");
      return updateAssignment(id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteAssignment } = await import("@/actions/kpiInsentif");
      return deleteAssignment(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

// ─── Calculation Results ──────────────────────────────────────────────────────

export function useCalculationResults(filters?: ResultFilters) {
  return useQuery({
    queryKey: [
      "kpi-insentif",
      "results",
      filters?.profileId,
      filters?.period,
      filters?.status,
      filters?.venueId,
      filters?.businessRole,
    ],
    queryFn: () => fetchKpiResults(filters),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
    enabled: !!filters?.period,
  });
}

export function useSaveCalculationResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { saveCalculationResult } = await import("@/actions/kpiInsentif");
      return saveCalculationResult(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

export function useFinalizeResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { finalizeResult } = await import("@/actions/kpiInsentif");
      return finalizeResult(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpi-insentif"] }),
  });
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export function useProfilesForAssignment() {
  return useQuery({
    queryKey: ["kpi-insentif", "profiles-for-assignment"],
    queryFn: () => fetchProfilesForAssignment(),
    staleTime: 10 * 60_000,
  });
}
