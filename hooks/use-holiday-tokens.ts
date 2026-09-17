"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAvailableHolidayTokens } from "@/services/holiday-token-service";

export function useHolidayTokens() {
  return useQuery({
    queryKey: ["holiday-tokens"],
    queryFn: fetchAvailableHolidayTokens,
    staleTime: 60 * 1000,
  });
}
