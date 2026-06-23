"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOnboardingTemplates,
  fetchOnboardingAssignments,
  fetchMyOnboarding,
} from "@/services/onboarding-service";
import {
  createOnboardingTemplate,
  updateOnboardingTemplate,
  deleteOnboardingTemplate,
  addOnboardingTemplateTask,
  updateOnboardingTemplateTask,
  deleteOnboardingTemplateTask,
  assignOnboarding,
  completeOnboardingTask,
} from "@/actions/onboarding";

export function useOnboardingTemplates() {
  return useQuery({
    queryKey: ["onboarding", "templates"],
    queryFn: fetchOnboardingTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOnboardingAssignments(params?: { status?: string }) {
  return useQuery({
    queryKey: ["onboarding", "assignments", params],
    queryFn: () => fetchOnboardingAssignments(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyOnboarding() {
  return useQuery({
    queryKey: ["onboarding", "my"],
    queryFn: fetchMyOnboarding,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOnboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createOnboardingTemplate>[0]) =>
      createOnboardingTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useUpdateOnboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateOnboardingTemplate>[1];
    }) => updateOnboardingTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useDeleteOnboardingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOnboardingTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useAddOnboardingTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof addOnboardingTemplateTask>[0]) =>
      addOnboardingTemplateTask(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useUpdateOnboardingTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateOnboardingTemplateTask>[1];
    }) => updateOnboardingTemplateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useDeleteOnboardingTemplateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOnboardingTemplateTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useAssignOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof assignOnboarding>[0]) => assignOnboarding(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}

export function useCompleteOnboardingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => completeOnboardingTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });
}
