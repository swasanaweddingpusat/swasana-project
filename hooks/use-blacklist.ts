"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBlacklistEntries } from "@/services/blacklistService";
import { createBlacklistEntry, deleteBlacklistEntry } from "@/actions/blacklist";

export function useBlacklistEntries() {
  return useQuery({
    queryKey: ["blacklist-entries"],
    queryFn: fetchBlacklistEntries,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBlacklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createBlacklistEntry>[0]) => createBlacklistEntry(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blacklist-entries"] }),
  });
}

export function useDeleteBlacklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBlacklistEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blacklist-entries"] }),
  });
}
