"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPayrollSettings } from "@/services/payroll-settings-service";
import { updatePayrollSettings } from "@/actions/payrollSettings";

export function usePayrollSettings() {
  return useQuery({
    queryKey: ["payroll-settings"],
    queryFn: fetchPayrollSettings,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdatePayrollSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updatePayrollSettings>[0]) =>
      updatePayrollSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-settings"] }),
  });
}
