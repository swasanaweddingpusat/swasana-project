"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkTypeApprovals,
  fetchPendingWorkTypeApprovalsForManager,
} from "@/services/attendance-service";
import {
  approveWorkType,
  rejectWorkType,
  managerApproveWorkType,
  managerRejectWorkType,
} from "@/actions/attendanceWorkTypeApproval";

export function useWorkTypeApprovals(params?: { status?: string }) {
  return useQuery({
    queryKey: ["work-type-approvals", params],
    queryFn: () => fetchWorkTypeApprovals(params),
    staleTime: 30 * 1000,
  });
}

export function usePendingWorkTypeApprovalsForManager() {
  return useQuery({
    queryKey: ["work-type-approvals", "pending"],
    queryFn: fetchPendingWorkTypeApprovalsForManager,
    staleTime: 30 * 1000,
  });
}

export function useManagerApproveWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerApproveWorkType>[0]) => managerApproveWorkType(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-type-approvals"] });
    },
  });
}

export function useManagerRejectWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerRejectWorkType>[0]) => managerRejectWorkType(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-type-approvals"] });
    },
  });
}

export function useApproveWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof approveWorkType>[0]) => approveWorkType(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-type-approvals"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useRejectWorkType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof rejectWorkType>[0]) => rejectWorkType(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-type-approvals"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}
