"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchShiftOverrides } from "@/services/shift-override-service";
import {
  createShiftOverride,
  updateShiftOverride,
  deleteShiftOverride,
} from "@/actions/shiftOverride";

export function useShiftOverrides(params?: {
  profileId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["shift-overrides", params],
    queryFn: () => fetchShiftOverrides(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateShiftOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createShiftOverride>[0]) => createShiftOverride(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-overrides"] }),
  });
}

export function useUpdateShiftOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateShiftOverride>[1];
    }) => updateShiftOverride(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-overrides"] }),
  });
}

export function useDeleteShiftOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShiftOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-overrides"] }),
  });
}
