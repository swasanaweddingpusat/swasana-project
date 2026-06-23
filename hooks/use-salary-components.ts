"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSalaryComponents } from "@/services/salary-component-service";
import {
  createSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent,
} from "@/actions/salaryComponent";

export function useSalaryComponents() {
  return useQuery({
    queryKey: ["salary-components"],
    queryFn: fetchSalaryComponents,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSalaryComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createSalaryComponent>[0]) =>
      createSalaryComponent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary-components"] }),
  });
}

export function useUpdateSalaryComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateSalaryComponent>[1];
    }) => updateSalaryComponent(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary-components"] }),
  });
}

export function useDeleteSalaryComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSalaryComponent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary-components"] }),
  });
}
