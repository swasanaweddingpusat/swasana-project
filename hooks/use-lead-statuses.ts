"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeadStatusItem } from "@/lib/queries/leads";

async function fetchLeadStatuses(category?: "WEDDINGS" | "MICE"): Promise<LeadStatusItem[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const res = await fetch(`/api/lead-statuses?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch lead statuses");
  return res.json();
}

export function useLeadStatuses(category?: "WEDDINGS" | "MICE") {
  return useQuery({
    queryKey: ["lead-statuses", category ?? "all"] as const,
    queryFn: () => fetchLeadStatuses(category),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
