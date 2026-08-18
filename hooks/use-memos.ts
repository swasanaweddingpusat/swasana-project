"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMemos } from "@/services/memoService";
import { createMemo, updateMemo, deleteMemo } from "@/actions/memo";

export function useMemos() {
  return useQuery({
    queryKey: ["memos"],
    queryFn: fetchMemos,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createMemo>[0]) => createMemo(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }),
  });
}

export function useUpdateMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateMemo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }),
  });
}

export function useDeleteMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMemo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memos"] }),
  });
}
