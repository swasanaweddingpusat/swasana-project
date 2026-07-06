"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { restoreBookingRevision, syncBookingPackage } from "@/actions/booking-revision";

export interface BookingRevisionItem {
  id: string;
  revisionNumber: number;
  reason: string | null;
  packageName: string;
  pax: number | null;
  price: number | null;
  venueName: string;
  createdAt: string;
}

interface RevisionsResponse {
  data: BookingRevisionItem[];
  total: number;
  page: number;
  limit: number;
}

async function fetchRevisions(bookingId: string): Promise<BookingRevisionItem[]> {
  const res = await fetch(`/api/bookings/${bookingId}/revisions?limit=100`);
  if (!res.ok) throw new Error("Failed to fetch revisions");
  const json = (await res.json()) as RevisionsResponse;
  return json.data ?? [];
}

/** List all revisions for a booking (newest first), enabled only when `enabled`. */
export function useBookingRevisions(bookingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["booking-revisions", bookingId],
    queryFn: () => fetchRevisions(bookingId!),
    enabled: enabled && !!bookingId,
    staleTime: 30_000,
  });
}

/** Restore a past revision as the active version (creates a new revision). */
export function useRestoreBookingRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bookingId: string; revisionId: string }) => restoreBookingRevision(vars),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", vars.bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-revisions", vars.bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });
}

/** Re-pull the booking's package snapshot from the current master Package. */
export function useSyncBookingPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bookingId: string }) => syncBookingPackage(vars),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-detail", vars.bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-revisions", vars.bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });
}
