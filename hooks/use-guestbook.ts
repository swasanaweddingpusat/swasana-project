"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchGuestbookEntries } from "@/services/guestbookService";
import { createGuestbookEntry, checkOutGuestbookEntry, updateGuestbookEntry, deleteGuestbookEntry } from "@/actions/guestbook";
import type { GuestbookFilterOptions } from "@/lib/queries/guestbookEntries";

export function useGuestbookEntries(params?: GuestbookFilterOptions & { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;
  return useQuery({
    queryKey: [
      "guestbook-entries",
      page,
      pageSize,
      params?.search,
      params?.venueId,
      params?.hostId,
      params?.dateFrom,
      params?.dateTo,
      params?.category,
      params?.interactionType,
    ],
    queryFn: () => fetchGuestbookEntries({ page, pageSize, ...params }),
    placeholderData: keepPreviousData,
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

export function useUpdateGuestbookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateGuestbookEntry(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}

export function useDeleteGuestbookEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGuestbookEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}
