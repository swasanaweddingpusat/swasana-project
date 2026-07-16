"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTrainingPrograms,
  fetchEmployeeDevelopments,
  fetchEmployeeCertifications,
} from "@/services/hr-development-service";
import {
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
  createEmployeeDevelopment,
  updateEmployeeDevelopment,
  deleteEmployeeDevelopment,
  createEmployeeCertification,
  updateEmployeeCertification,
  deleteEmployeeCertification,
} from "@/actions/hrDevelopment";

// ─── Training Programs ────────────────────────────────────────────────────────

export function useTrainingPrograms() {
  return useQuery({
    queryKey: ["hr-development", "training-programs"],
    queryFn: fetchTrainingPrograms,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTrainingProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createTrainingProgram>[0]) =>
      createTrainingProgram(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useUpdateTrainingProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateTrainingProgram>[1];
    }) => updateTrainingProgram(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useDeleteTrainingProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrainingProgram(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

// ─── Employee Developments ────────────────────────────────────────────────────

export function useEmployeeDevelopments() {
  return useQuery({
    queryKey: ["hr-development", "employee-developments"],
    queryFn: fetchEmployeeDevelopments,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployeeDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createEmployeeDevelopment>[0]) =>
      createEmployeeDevelopment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useUpdateEmployeeDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateEmployeeDevelopment>[1];
    }) => updateEmployeeDevelopment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useDeleteEmployeeDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployeeDevelopment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

// ─── Employee Certifications ──────────────────────────────────────────────────

export function useEmployeeCertifications() {
  return useQuery({
    queryKey: ["hr-development", "employee-certifications"],
    queryFn: fetchEmployeeCertifications,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployeeCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createEmployeeCertification>[0]) =>
      createEmployeeCertification(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useUpdateEmployeeCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateEmployeeCertification>[1];
    }) => updateEmployeeCertification(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}

export function useDeleteEmployeeCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployeeCertification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-development"] }),
  });
}
