"use client";

import { useQuery } from "@tanstack/react-query";
import type { EventTypesResult } from "@/lib/queries/event-types";

async function fetchEventTypes(category?: "WEDDINGS" | "MICE"): Promise<EventTypesResult> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const res = await fetch(`/api/event-types?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch event types");
  return res.json();
}

export function useEventTypes(category?: "WEDDINGS" | "MICE") {
  return useQuery<EventTypesResult>({
    queryKey: ["event-types", category ?? "all"] as const,
    queryFn: () => fetchEventTypes(category),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
