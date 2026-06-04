"use client";

import { useQuery } from "@tanstack/react-query";
import { getBookingFinanceDetailClient } from "@/services/booking-finance-service";
import type { BookingFinanceDetail } from "@/lib/queries/booking-finance-detail";

export function useBookingFinanceDetail(
  bookingId: string | null,
): {
  data: BookingFinanceDetail | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ["booking-finance-detail", bookingId],
    queryFn: () => getBookingFinanceDetailClient(bookingId!),
    enabled: !!bookingId,
    staleTime: 0, // Always re-fetch when drawer opens to get fresh data
    gcTime: 0,
  });

  return { data, isLoading, error: error as Error | null };
}
