"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApprovalFlowsResult } from "@/lib/queries/approval-flows";
import { upsertApprovalFlow, deleteApprovalFlow } from "@/actions/approval-flow";

export function useApprovalFlows() {
  return useQuery<ApprovalFlowsResult>({
    queryKey: ["approval-flows"],
    queryFn: async () => {
      const res = await fetch("/api/approval-flows");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpsertApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof upsertApprovalFlow>[0]) => upsertApprovalFlow(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-flows"] }),
  });
}

export function useDeleteApprovalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApprovalFlow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-flows"] }),
  });
}
