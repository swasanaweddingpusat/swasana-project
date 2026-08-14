"use client";

import { useQuery } from "@tanstack/react-query";
import type { AccessibleModule } from "@/lib/queries/modules";

async function fetchModules(): Promise<AccessibleModule[]> {
  const res = await fetch("/api/modules");
  if (!res.ok) throw new Error("Failed to load modules");
  return res.json();
}

export function useModules() {
  return useQuery({
    queryKey: ["modules"],
    queryFn: fetchModules,
    staleTime: 5 * 60 * 1000,
  });
}
