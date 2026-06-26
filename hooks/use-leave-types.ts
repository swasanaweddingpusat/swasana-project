"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLeaveTypes } from "@/services/leave-type-service";
import {
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
} from "@/actions/leaveType";

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: fetchLeaveTypes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createLeaveType>[0]) =>
      createLeaveType(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-types"] }),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateLeaveType>[1];
    }) => updateLeaveType(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-types"] }),
  });
}

export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLeaveType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-types"] }),
  });
}
