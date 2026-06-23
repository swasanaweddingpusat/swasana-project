"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLeaveRequests,
  fetchMyLeaveRequests,
  fetchPendingForManager,
  fetchLeaveCalendar,
} from "@/services/leave-request-service";
import {
  submitLeaveRequest,
  managerApproveLeave,
  managerRejectLeave,
  hrApproveLeave,
  hrRejectLeave,
  cancelLeaveRequest,
} from "@/actions/leaveRequest";

export function useLeaveRequests(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}) {
  return useQuery({
    queryKey: ["leave-requests", params],
    queryFn: () => fetchLeaveRequests(params),
    staleTime: 60 * 1000,
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ["leave-requests", "my"],
    queryFn: fetchMyLeaveRequests,
    staleTime: 60 * 1000,
  });
}

export function usePendingForManager() {
  return useQuery({
    queryKey: ["leave-requests", "pending"],
    queryFn: fetchPendingForManager,
    staleTime: 30 * 1000,
  });
}

export function useLeaveCalendar(params: {
  departmentId?: string;
  startDate: string;
  endDate: string;
}) {
  return useQuery({
    queryKey: ["leave-calendar", params],
    queryFn: () => fetchLeaveCalendar(params),
    staleTime: 5 * 60 * 1000,
    enabled: !!params.startDate && !!params.endDate,
  });
}

export function useSubmitLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof submitLeaveRequest>[0]) =>
      submitLeaveRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    },
  });
}

export function useManagerApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerApproveLeave>[0]) =>
      managerApproveLeave(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}

export function useManagerRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerRejectLeave>[0]) =>
      managerRejectLeave(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}

export function useHrApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrApproveLeave>[0]) =>
      hrApproveLeave(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    },
  });
}

export function useHrRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrRejectLeave>[0]) =>
      hrRejectLeave(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}

export function useCancelLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof cancelLeaveRequest>[0]) =>
      cancelLeaveRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      qc.invalidateQueries({ queryKey: ["leave-balances"] });
    },
  });
}
