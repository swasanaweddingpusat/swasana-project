"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkLocations } from "@/services/work-location-service";
import {
  createWorkLocation,
  updateWorkLocation,
  deleteWorkLocation,
} from "@/actions/workLocation";

export function useWorkLocations() {
  return useQuery({
    queryKey: ["work-locations"],
    queryFn: fetchWorkLocations,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWorkLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createWorkLocation>[0]) => createWorkLocation(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-locations"] }),
  });
}

export function useUpdateWorkLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateWorkLocation>[1];
    }) => updateWorkLocation(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-locations"] }),
  });
}

export function useDeleteWorkLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkLocation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-locations"] }),
  });
}
