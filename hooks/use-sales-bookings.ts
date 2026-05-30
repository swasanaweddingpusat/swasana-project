"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSalesBookings } from "@/services/group-service";

export function useSalesBookings(salesId: string | null, take = 5) {
  return useQuery({
    queryKey: ["sales-bookings", salesId, take],
    queryFn: () => fetchSalesBookings(salesId!, take),
    enabled: !!salesId,
    staleTime: 60_000,
  });
}
