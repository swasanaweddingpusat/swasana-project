"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLeaveBalances } from "@/services/leave-balance-service";
import { generateLeaveBalances, adjustLeaveBalance } from "@/actions/leaveBalance";

export function useLeaveBalances(params?: {
  profileId?: string;
  leaveTypeId?: string;
  year?: number;
}) {
  return useQuery({
    queryKey: ["leave-balances", params],
    queryFn: () => fetchLeaveBalances(params),
    staleTime: 60 * 1000,
  });
}

export function useGenerateLeaveBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof generateLeaveBalances>[0]) =>
      generateLeaveBalances(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-balances"] }),
  });
}

export function useAdjustLeaveBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adjustLeaveBalance>[0]) =>
      adjustLeaveBalance(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-balances"] }),
  });
}
