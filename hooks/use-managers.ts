"use client";

import { useQuery } from "@tanstack/react-query";
import type { ManagerProfile } from "@/lib/queries/users";

async function fetchManagers(): Promise<ManagerProfile[]> {
  const res = await fetch("/api/managers");
  if (!res.ok) throw new Error("Failed to fetch managers");
  return res.json();
}

export function useManagers(): {
  managers: ManagerProfile[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["managers"],
    queryFn: fetchManagers,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { managers: data ?? [], isLoading };
}
