import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoriesQueryResult } from "@/lib/queries/categories";
import { createCategory } from "@/actions/category";

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

/**
 * Create a category and insert it into the ["categories"] cache synchronously.
 *
 * We do NOT invalidateQueries here: GET /api/categories is served from a
 * `"use cache"` route with cacheLife("hours"), so an immediate refetch races
 * the server-side revalidateTag and usually returns the STALE list (without the
 * new row). That made the freshly-added option miss both the dropdown and the
 * auto-select until a hard refresh. setQueryData lands the new category in the
 * cache instantly so it appears and auto-selects with no round-trip.
 */
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: (res) => {
      if (!res.success) return;
      qc.setQueryData<CategoriesQueryResult>(["categories"], (old) => {
        const list = old ?? [];
        if (list.some((c) => c.id === res.category.id)) return list;
        const nextSort = list.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
        return [...list, { id: res.category.id, name: res.category.name, sortOrder: nextSort }];
      });
    },
  });
}
