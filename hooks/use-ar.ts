"use client";

import { useQuery } from "@tanstack/react-query";
import { getARBookingsClient } from "@/services/ar-service";
import type { ARBookingsResult } from "@/lib/queries/ar";

export function useAR(initialData?: ARBookingsResult) {
  return useQuery({
    queryKey: ["ar-bookings"],
    queryFn: getARBookingsClient,
    initialData,
    // Setiap mutasi yang mengubah piutang (ack, invoice issue/void, edit TOP)
    // sudah invalidateQueries(["ar-bookings"]) di hook masing-masing — itu
    // memaksa refetch terlepas dari staleTime. Jadi staleTime wajar (samain
    // dengan pola use-bookings.ts) cukup, tidak perlu selalu-stale + always-refetch.
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
