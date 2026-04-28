"use client";

import { useQuery } from "@tanstack/react-query";
import { getARBookingsClient } from "@/services/ar-service";
import type { ARBookingsResult } from "@/lib/queries/ar";

export function useAR(initialData?: ARBookingsResult) {
  return useQuery({
    queryKey: ["ar-bookings"],
    queryFn: getARBookingsClient,
    initialData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
