"use client";

import { useQuery } from "@tanstack/react-query";
import { getARBookingsClient } from "@/services/ar-service";
import type { ARBookingsResult } from "@/lib/queries/ar";

export function useAR(initialData?: ARBookingsResult) {
  return useQuery({
    queryKey: ["ar-bookings"],
    queryFn: getARBookingsClient,
    initialData,
    // staleTime 0 + refetchOnMount "always" biar setelah invalidateQueries (post-ack)
    // data langsung di-refetch, tidak stale dari cache lama.
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
