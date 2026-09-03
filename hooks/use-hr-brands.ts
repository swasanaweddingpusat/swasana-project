"use client";

import { useQuery } from "@tanstack/react-query";

type BrandOption = {
  id: string;
  name: string;
  code: string;
};

async function fetchHrBrands(): Promise<BrandOption[]> {
  const res = await fetch("/api/hr/brands");
  if (!res.ok) throw new Error("Failed to fetch brands");
  const data = await res.json() as Array<{ id: string; name: string; code: string }>;
  return data;
}

export function useHrBrands() {
  return useQuery({
    queryKey: ["hr-brands"],
    queryFn: fetchHrBrands,
    staleTime: 10 * 60 * 1000,
  });
}
