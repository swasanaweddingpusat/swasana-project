"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendanceCorrections,
  fetchMyAttendanceCorrections,
} from "@/services/attendance-correction-service";
import {
  submitAttendanceCorrection,
  hrApproveAttendanceCorrection,
  hrRejectAttendanceCorrection,
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
    staleTime: 30 * 1000,
  });
}

export function useMyAttendanceCorrections() {
  return useQuery({
    queryKey: ["attendance-corrections", "my"],
    queryFn: fetchMyAttendanceCorrections,
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

export function useHrApproveAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrApproveAttendanceCorrection>[0]) =>
      hrApproveAttendanceCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useHrRejectAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof hrRejectAttendanceCorrection>[0]) =>
      hrRejectAttendanceCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
  });
}

export function useCancelAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof cancelAttendanceCorrection>[0]) =>
      cancelAttendanceCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
  });
}
