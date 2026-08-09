"use client";

import { useQuery } from "@tanstack/react-query";

type BrandOption = {
  id: string;
  name: string;
  code: string;
};

async function fetchBrands(): Promise<BrandOption[]> {
  const res = await fetch("/api/hr/brands");
  if (!res.ok) throw new Error("Failed to fetch brands");
  const data = await res.json() as Array<{ id: string; name: string; code: string }>;
  return data;
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: fetchBrands,
    staleTime: 10 * 60 * 1000,
  });
}
