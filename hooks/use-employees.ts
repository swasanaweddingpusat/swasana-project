"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployees,
  fetchEmployeeById,
  fetchEmployeeDocuments,
  fetchEmploymentHistory,
} from "@/services/employee-service";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
  addEmploymentHistory,
} from "@/actions/employee";

export function useEmployees(params: {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: string;
  employmentType?: string;
}) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => fetchEmployees(params),
    staleTime: 60 * 1000,
  });
}

export function useEmployeeDetail(id: string) {
  return useQuery({
    queryKey: ["employees", id],
    queryFn: () => fetchEmployeeById(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useEmployeeDocuments(id: string) {
  return useQuery({
    queryKey: ["employees", id, "documents"],
    queryFn: () => fetchEmployeeDocuments(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useEmploymentHistory(id: string) {
  return useQuery({
    queryKey: ["employees", id, "history"],
    queryFn: () => fetchEmploymentHistory(id),
    staleTime: 60 * 1000,
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createEmployee>[0]) => createEmployee(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateEmployee>[1];
    }) => updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUploadEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      formData,
    }: {
      profileId: string;
      formData: FormData;
    }) => uploadEmployeeDocument(profileId, formData),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["employees", vars.profileId] }),
  });
}

export function useDeleteEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => deleteEmployeeDocument(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useAddEmploymentHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      data,
    }: {
      profileId: string;
      data: Parameters<typeof addEmploymentHistory>[1];
    }) => addEmploymentHistory(profileId, data),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["employees", vars.profileId] }),
  });
}
