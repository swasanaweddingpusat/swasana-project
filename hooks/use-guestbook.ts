"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGuestbookEntries } from "@/services/guestbookService";
import { createGuestbookEntry, checkOutGuestbookEntry } from "@/actions/guestbook";

export function useGuestbookEntries() {
  return useQuery({
    queryKey: ["guestbook-entries"],
    queryFn: fetchGuestbookEntries,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGuestbookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createGuestbookEntry>[0]) => createGuestbookEntry(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}

export function useCheckOutGuestbookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checkOutGuestbookEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}
