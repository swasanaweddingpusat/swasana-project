import { useQuery } from "@tanstack/react-query";
import type { VenuesQueryResult } from "@/lib/queries/venues";

async function fetchVenues(): Promise<VenuesQueryResult> {
  const res = await fetch("/api/venues");
  if (!res.ok) throw new Error("Failed to fetch venues");
  return res.json();
}

export function useVenues() {
  return useQuery<VenuesQueryResult>({
    queryKey: ["venues"],
    queryFn: fetchVenues,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
