"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJobPostings, fetchJobPostingById } from "@/services/job-posting-service";
import {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  publishJobPosting,
  closeJobPosting,
} from "@/actions/jobPosting";

export function useJobPostings() {
  return useQuery({
    queryKey: ["job-postings"],
    queryFn: fetchJobPostings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useJobPostingDetail(id: string) {
  return useQuery({
    queryKey: ["job-postings", id],
    queryFn: () => fetchJobPostingById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createJobPosting>[0]) => createJobPosting(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings"] }),
  });
}

export function useUpdateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateJobPosting>[1] }) =>
      updateJobPosting(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings"] }),
  });
}

export function useDeleteJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJobPosting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings"] }),
  });
}

export function usePublishJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishJobPosting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings"] }),
  });
}

export function useCloseJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeJobPosting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-postings"] }),
  });
}
