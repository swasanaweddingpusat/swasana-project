"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPayrollPeriods,
  fetchPayrollPeriodById,
} from "@/services/payroll-period-service";
import {
  generatePayroll,
  finalizePayroll,
  markPayrollPaid,
  deletePayrollPeriod,
} from "@/actions/payroll";

export function usePayrollPeriods() {
  return useQuery({
    queryKey: ["payroll-periods"],
    queryFn: fetchPayrollPeriods,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePayrollPeriodDetail(id: string) {
  return useQuery({
    queryKey: ["payroll-periods", id],
    queryFn: () => fetchPayrollPeriodById(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof generatePayroll>[0]) => generatePayroll(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-periods"] }),
  });
}

export function useFinalizePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) => finalizePayroll(periodId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-periods"] }),
  });
}

export function useMarkPayrollPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) => markPayrollPaid(periodId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-periods"] }),
  });
}

export function useDeletePayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) => deletePayrollPeriod(periodId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-periods"] }),
  });
}
