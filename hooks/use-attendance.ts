"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendanceToday,
  fetchAttendanceSettings,
  fetchAttendanceList,
  fetchMyAttendanceHistory,
  fetchEmployeeAttendanceOverview,
  clockIn,
  clockOut,
  updateAttendanceSettings,
} from "@/services/attendance-service";
import type { AttendanceTodayResponse, AttendanceSettingsResult, AttendanceListResult, MyAttendanceHistoryResult, EmployeeAttendanceOverview } from "@/lib/queries/attendance";
import type { AttendanceListQuery, AttendanceOverviewQuery } from "@/lib/validations/attendance";

export function useAttendanceToday() {
  return useQuery<AttendanceTodayResponse>({
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

export function useEmployeeAttendanceOverview(params: AttendanceOverviewQuery | null) {
  return useQuery<EmployeeAttendanceOverview>({
    queryKey: ["attendance-overview", params],
    queryFn: () => fetchEmployeeAttendanceOverview(params as AttendanceOverviewQuery),
    enabled: !!params?.profileId,
    staleTime: 60 * 1000,
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
