"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEmployeeSalaries } from "@/services/employee-salary-service";
import {
  setEmployeeSalary,
  bulkSetEmployeeSalary,
  deleteEmployeeSalary,
} from "@/actions/employeeSalary";

export function useEmployeeSalaries(params?: {
  profileId?: string;
  salaryComponentId?: string;
}) {
  return useQuery({
    queryKey: ["employee-salaries", params],
    queryFn: () => fetchEmployeeSalaries(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSetEmployeeSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof setEmployeeSalary>[0]) => setEmployeeSalary(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee-salaries"] }),
  });
}

export function useBulkSetEmployeeSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof bulkSetEmployeeSalary>[0]) =>
      bulkSetEmployeeSalary(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee-salaries"] }),
  });
}

export function useDeleteEmployeeSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployeeSalary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee-salaries"] }),
  });
}
