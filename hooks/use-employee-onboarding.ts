"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  submitOnboardingForm,
  createOnboardingFormLink,
  regenerateOnboardingFormLink,
  revokeOnboardingFormLink,
} from "@/actions/employeeOnboarding";
import { fetchOnboardingFormLinks } from "@/services/onboardingFormLinkService";

export function useSubmitOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => submitOnboardingForm(formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useOnboardingFormLinks() {
  return useQuery({
    queryKey: ["onboarding-form-links"],
    queryFn: fetchOnboardingFormLinks,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOnboardingFormLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createOnboardingFormLink>[0]) =>
      createOnboardingFormLink(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-form-links"] }),
  });
}

export function useRegenerateOnboardingFormLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => regenerateOnboardingFormLink(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-form-links"] }),
  });
}

export function useRevokeOnboardingFormLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => revokeOnboardingFormLink(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-form-links"] }),
  });
}
