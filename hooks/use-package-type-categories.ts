"use client";

import { useQuery } from "@tanstack/react-query";
import type { PackageTypeCategoriesResult } from "@/lib/queries/package-type-categories";

async function fetchPackageTypeCategories(): Promise<PackageTypeCategoriesResult> {
  const res = await fetch("/api/package-type-categories");
  if (!res.ok) throw new Error("Failed to fetch package type categories");
  return res.json();
}

export function usePackageTypeCategories() {
  return useQuery<PackageTypeCategoriesResult>({
    queryKey: ["package-type-categories"] as const,
    queryFn: fetchPackageTypeCategories,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
