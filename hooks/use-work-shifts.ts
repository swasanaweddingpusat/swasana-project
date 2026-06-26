"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkShifts } from "@/services/work-shift-service";
import {
  createWorkShift,
  updateWorkShift,
  deleteWorkShift,
} from "@/actions/workShift";

export function useWorkShifts() {
  return useQuery({
    queryKey: ["work-shifts"],
    queryFn: fetchWorkShifts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createWorkShift>[0]) => createWorkShift(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts"] }),
  });
}

export function useUpdateWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateWorkShift>[1];
    }) => updateWorkShift(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts"] }),
  });
}

export function useDeleteWorkShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkShift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-shifts"] }),
  });
}
