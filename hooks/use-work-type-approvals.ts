"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkTypeApprovals } from "@/services/attendance-service";
import { approveWorkType, rejectWorkType } from "@/actions/attendanceWorkTypeApproval";

export function useWorkTypeApprovals() {
  return useQuery({
    queryKey: ["work-type-approvals"],
    queryFn: fetchWorkTypeApprovals,
    staleTime: 30 * 1000,
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
