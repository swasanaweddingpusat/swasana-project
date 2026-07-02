"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPositions } from "@/services/position-service";
import {
  createPosition,
  updatePosition,
  deletePosition,
} from "@/actions/position";

export function usePositions(departmentId?: string) {
  return useQuery({
    queryKey: ["positions", departmentId],
    queryFn: () => fetchPositions(departmentId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPosition>[0]) =>
      createPosition(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updatePosition>[1];
    }) => updatePosition(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePosition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["positions"] }),
  });
}
