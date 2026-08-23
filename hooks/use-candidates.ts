"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCandidates } from "@/services/candidate-service";
import {
  addCandidate,
  moveCandidateStage,
  hireCandidate,
  rejectCandidate,
  addCandidateNote,
  rateCandidate,
  markCandidateViewed,
  generateCandidateInvite,
} from "@/actions/candidate";

export function useCandidates(params?: { jobPostingId?: string; stage?: string }) {
  return useQuery({
    queryKey: ["candidates", params?.jobPostingId, params?.stage],
    queryFn: () => fetchCandidates(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof addCandidate>[0]) => addCandidate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useMoveCandidateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof moveCandidateStage>[0]) => moveCandidateStage(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useHireCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) => hireCandidate(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useRejectCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof rejectCandidate>[0]) => rejectCandidate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useAddCandidateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof addCandidateNote>[0]) => addCandidateNote(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useRateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof rateCandidate>[0]) => rateCandidate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useMarkCandidateViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markCandidateViewed(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["job-postings"] });
    },
  });
}

export function useGenerateCandidateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: string) => generateCandidateInvite(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}
