"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCandidateSubmissions } from "@/services/candidateSubmissionService";

export function useCandidateSubmissions(recruitmentRequestId: string | null) {
  return useQuery({
    queryKey: ["candidate-submissions", recruitmentRequestId],
    queryFn: () => fetchCandidateSubmissions(recruitmentRequestId!),
    enabled: !!recruitmentRequestId,
    staleTime: 2 * 60 * 1000,
  });
}
