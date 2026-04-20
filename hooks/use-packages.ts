"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPackages } from "@/services/package-service";
import {
  createPackage,
  updatePackage,
  deletePackage,
  deleteBulkPackages,
  createVariant,
  updateVariant,
  deleteVariant,
  saveVendorItems,
  saveInternalItems,
} from "@/actions/package";
import type { PackagesQueryResult } from "@/lib/queries/packages";

export function usePackages(venueId?: string) {
  return useQuery<PackagesQueryResult>({
    queryKey: ["packages", venueId],
    queryFn: () => fetchPackages(venueId),
    staleTime: 60 * 1000,
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createPackage>[0]) => createPackage(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePackage>[1] }) =>
      updatePackage(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePackage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useDeleteBulkPackages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteBulkPackages(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createVariant>[0]) => createVariant(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateVariant>[1] }) =>
      updateVariant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVariant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useSaveVendorItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, items }: { variantId: string; items: { categoryName: string; itemText: string }[] }) =>
      saveVendorItems(variantId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useSaveInternalItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, items }: { variantId: string; items: { itemName: string; itemDescription: string }[] }) =>
      saveInternalItems(variantId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}
