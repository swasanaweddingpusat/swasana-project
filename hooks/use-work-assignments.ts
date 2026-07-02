"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkAssignments } from "@/services/work-assignment-service";
import {
  createWorkAssignment,
  updateWorkAssignment,
  deleteWorkAssignment,
  bulkCreateWorkAssignment,
} from "@/actions/workAssignment";

export function useWorkAssignments(params?: {
  workLocationId?: string;
  workShiftId?: string;
  profileId?: string;
}) {
  return useQuery({
    queryKey: ["work-assignments", params],
    queryFn: () => fetchWorkAssignments(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWorkAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createWorkAssignment>[0]) => createWorkAssignment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-assignments"] }),
  });
}

export function useUpdateWorkAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateWorkAssignment>[1];
    }) => updateWorkAssignment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-assignments"] }),
  });
}

export function useDeleteWorkAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-assignments"] }),
  });
}

export function useBulkCreateWorkAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof bulkCreateWorkAssignment>[0]) => bulkCreateWorkAssignment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-assignments"] }),
  });
}
