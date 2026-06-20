"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendanceToday,
  fetchAttendanceSettings,
  fetchAttendanceList,
  fetchMyAttendanceHistory,
  clockIn,
  clockOut,
  updateAttendanceSettings,
} from "@/services/attendance-service";
import type { AttendanceTodayResult, AttendanceSettingsResult, AttendanceListResult, MyAttendanceHistoryResult } from "@/lib/queries/attendance";
import type { AttendanceListQuery } from "@/lib/validations/attendance";

export function useAttendanceToday() {
  return useQuery<AttendanceTodayResult>({
    queryKey: ["attendance-today"],
    queryFn: fetchAttendanceToday,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useAttendanceSettings() {
  return useQuery<AttendanceSettingsResult>({
    queryKey: ["attendance-settings"],
    queryFn: fetchAttendanceSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAttendanceList(params: AttendanceListQuery) {
  return useQuery<AttendanceListResult>({
    queryKey: ["attendance-list", params],
    queryFn: () => fetchAttendanceList(params),
    staleTime: 60 * 1000,
  });
}

export function useMyAttendanceHistory() {
  return useQuery<MyAttendanceHistoryResult>({
    queryKey: ["attendance-my-history"],
    queryFn: fetchMyAttendanceHistory,
    staleTime: 60 * 1000,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-my-history"] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance-my-history"] });
    },
  });
}

export function useUpdateAttendanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAttendanceSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
    },
  });
}
