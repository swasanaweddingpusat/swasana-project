"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  fetchGuestbookEntries,
  fetchGuestVisitHistory,
  fetchGuestbookFunnelReport,
  fetchGuestbookFunnelBucketEntries,
} from "@/services/guestbookService";
import {
  createGuestbookEntry,
  updateGuestbookEntry,
  deleteGuestbookEntry,
  confirmGuestbookAttendance,
  lookupGuestbookEntryByCode,
  deleteBulkGuestbookEntries,
  refreshGuestbookAdsUrl,
} from "@/actions/guestbook";
import type { GuestbookFilterOptions, GuestbookFunnelBucketKey } from "@/lib/queries/guestbookEntries";

export function useGuestbookEntries(params?: GuestbookFilterOptions & { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 50;
  return useQuery({
    queryKey: [
      "guestbook-entries",
      page,
      pageSize,
      params?.search,
      params?.venueIds,
      params?.hostId,
      params?.dateFrom,
      params?.dateTo,
      params?.categories,
      params?.statusIds,
      params?.sourceOfInformationIds,
      params?.festivalIds,
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

export function useDeleteBulkGuestbookEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteBulkGuestbookEntries(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}

export function useConfirmGuestbookAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ guestCode, actualGuestCount }: { guestCode: string; actualGuestCount?: number }) =>
      confirmGuestbookAttendance(guestCode, actualGuestCount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guestbook-entries"] }),
  });
}

export function useLookupGuestbookEntryByCode() {
  return useMutation({
    mutationFn: (guestCode: string) => lookupGuestbookEntryByCode(guestCode),
  });
}

export function useGuestVisitHistory(entryId: string | undefined) {
  return useQuery({
    queryKey: ["guestbook-visit-history", entryId],
    queryFn: () => fetchGuestVisitHistory(entryId as string),
    enabled: !!entryId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshGuestbookAdsUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => refreshGuestbookAdsUrl(id),
    onSuccess: (result) => {
      if (result.success && result.adsUrl) qc.invalidateQueries({ queryKey: ["guestbook-entries"] });
    },
  });
}

export function useGuestbookFunnelReport(params?: GuestbookFilterOptions) {
  return useQuery({
    queryKey: [
      "guestbook-funnel-report",
      params?.search,
      params?.venueIds,
      params?.hostId,
      params?.dateFrom,
      params?.dateTo,
      params?.categories,
      params?.statusIds,
      params?.sourceOfInformationIds,
      params?.festivalIds,
    ],
    queryFn: () => fetchGuestbookFunnelReport(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGuestbookFunnelBucketEntries(
  bucket: GuestbookFunnelBucketKey | undefined,
  params?: Pick<GuestbookFilterOptions, "venueIds" | "hostId" | "dateFrom" | "dateTo">
) {
  return useQuery({
    queryKey: ["guestbook-funnel-bucket", bucket, params?.venueIds, params?.hostId, params?.dateFrom, params?.dateTo],
    queryFn: () => fetchGuestbookFunnelBucketEntries(bucket as GuestbookFunnelBucketKey, params),
    enabled: !!bucket,
    staleTime: 60 * 1000,
  });
}
