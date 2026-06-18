"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFinanceOverview } from "@/services/finance-service";

export function useFinanceOverview() {
  return useQuery({
    queryKey: ["finance", "overview"],
    queryFn: () => fetchFinanceOverview(),
    staleTime: 60_000,
  });
}
