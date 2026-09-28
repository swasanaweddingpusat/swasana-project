"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendanceCorrections,
  fetchMyAttendanceCorrections,
  fetchPendingCorrectionsForManager,
} from "@/services/attendance-correction-service";
import {
  submitAttendanceCorrection,
  managerApproveCorrection,
  managerRejectCorrection,
  hrApproveCorrection,
  hrRejectCorrection,
  cancelAttendanceCorrection,
} from "@/actions/attendanceCorrection";

export function useAttendanceCorrections(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}) {
  return useQuery({
    queryKey: ["attendance-corrections", params],
    queryFn: () => fetchAttendanceCorrections(params),
    staleTime: 60 * 1000,
  });
}

export function useMyAttendanceCorrections() {
  return useQuery({
    queryKey: ["attendance-corrections", "my"],
    queryFn: fetchMyAttendanceCorrections,
    staleTime: 60 * 1000,
  });
}

export function usePendingCorrectionsForManager() {
  return useQuery({
    queryKey: ["attendance-corrections", "pending"],
    queryFn: fetchPendingCorrectionsForManager,
    staleTime: 30 * 1000,
  });
}

export function useSubmitAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof submitAttendanceCorrection>[0]) =>
      submitAttendanceCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
  });
}

export function useManagerApproveCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerApproveCorrection>[0]) =>
      managerApproveCorrection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-corrections"] }),
  });
}

export function useManagerRejectCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof managerRejectCorrection>[0]) =>
      managerRejectCorrection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-corrections"] }),
  });
}

export function useHrApproveCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrApproveCorrection>[0]) =>
      hrApproveCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useHrRejectCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrRejectCorrection>[0]) =>
      hrRejectCorrection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-corrections"] }),
  });
}

export function useCancelAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof cancelAttendanceCorrection>[0]) =>
      cancelAttendanceCorrection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance-corrections"] }),
  });
}
