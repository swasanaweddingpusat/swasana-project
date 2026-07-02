"use client";

import { useQuery, type RefetchOptions, type QueryObserverResult } from "@tanstack/react-query";
import { fetchBookingDetail } from "@/services/booking-detail-service";
import type { BookingDetail } from "@/lib/queries/bookings";

/**
 * Cached fetch of a single booking's full detail. Shares the
 * ["booking-detail", id] cache key with the on-hover prefetch in the bookings
 * table, so opening a row whose detail was just prefetched (within staleTime)
 * renders instantly without a refetch.
 */
export function useBookingDetail(
  bookingId: string | null,
  open: boolean,
): {
  data: BookingDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<BookingDetail, Error>>;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["booking-detail", bookingId],
    queryFn: () => fetchBookingDetail(bookingId!),
    enabled: open && !!bookingId,
    staleTime: 30_000,
  });

  return { data, isLoading, error: error as Error | null, refetch };
}
