"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchVendorCategories, fetchVendorCategoriesLite, fetchVendors } from "@/services/vendor-service";
import {
  createVendorCategory,
  updateVendorCategory,
  deleteVendorCategory,
  createVendor,
  updateVendor,
  deleteVendor,
} from "@/actions/vendor";
import type { VendorCategoriesResult, VendorCategoriesLiteResult, VendorsResult } from "@/lib/queries/vendors";

export function useVendorCategories() {
  return useQuery<VendorCategoriesResult>({
    queryKey: ["vendors"],
    queryFn: fetchVendorCategories,
    staleTime: 60 * 1000,
  });
}

/** Lightweight category list (id, name, vendor count) — for filter dropdowns. */
export function useVendorCategoriesLite() {
  return useQuery<VendorCategoriesLiteResult>({
    queryKey: ["vendors", "categories-lite"],
    queryFn: fetchVendorCategoriesLite,
    staleTime: 60 * 1000,
  });
}

interface VendorListParams {
  page: number;
  pageSize: number;
  search: string;
  categoryId: string;
}

/** Server-driven paginated + searchable vendor listing. */
export function useVendorList(params: VendorListParams) {
  return useQuery<VendorsResult>({
    queryKey: ["vendors", "list", params.page, params.pageSize, params.search, params.categoryId],
    queryFn: () => fetchVendors(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useCreateVendorCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createVendorCategory>[0]) => createVendorCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useUpdateVendorCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateVendorCategory>[1] }) =>
      updateVendorCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeleteVendorCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVendorCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createVendor>[0]) => createVendor(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateVendor>[1] }) =>
      updateVendor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVendor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}
