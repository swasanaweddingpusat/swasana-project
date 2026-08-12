"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRecruitmentRequests } from "@/services/recruitmentRequestService";
import { createRecruitmentRequest, regenerateFormLink, revokeFormLink } from "@/actions/recruitmentRequest";

export function useRecruitmentRequests() {
  return useQuery({
    queryKey: ["recruitment-requests"],
    queryFn: fetchRecruitmentRequests,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRecruitmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createRecruitmentRequest>[0]) =>
      createRecruitmentRequest(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-requests"] }),
  });
}

export function useRegenerateFormLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recruitmentRequestId: string) => regenerateFormLink(recruitmentRequestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-requests"] }),
  });
}

export function useRevokeFormLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recruitmentRequestId: string) => revokeFormLink(recruitmentRequestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-requests"] }),
  });
}
