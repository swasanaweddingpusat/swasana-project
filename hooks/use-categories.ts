import { useQuery } from "@tanstack/react-query";
import type { CategoriesQueryResult } from "@/lib/queries/categories";

async function fetchCategories(): Promise<CategoriesQueryResult> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export function useCategories() {
  return useQuery<CategoriesQueryResult>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
