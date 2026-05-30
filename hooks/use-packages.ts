"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPackages } from "@/services/package-service";
import {
  createPackage,
  updatePackage,
  deletePackage,
  deleteBulkPackages,
  saveVendorItems,
  saveInternalItems,
  savePackagePrices,
  updatePackageTC,
  togglePackageAvailable,
} from "@/actions/package";
import type { PackagesQueryResult } from "@/lib/queries/packages";
import type { ApprovalRecordWithSteps } from "@/lib/queries/packages";

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

export function useTogglePackageAvailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => togglePackageAvailable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useSaveVendorItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, items }: { packageId: string; items: { categoryName: string; itemText: string }[] }) =>
      saveVendorItems(packageId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useSaveInternalItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, items }: { packageId: string; items: { itemName: string; itemDescription: string }[] }) =>
      saveInternalItems(packageId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function usePackageApprovals() {
  return useQuery<ApprovalRecordWithSteps[]>({
    queryKey: ["package-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/approval-records?module=package");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.data ?? json;
    },
    staleTime: 30 * 1000,
  });
}

export function useSavePackagePrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      packageId,
      categories,
      margin,
      sellingPrice,
    }: {
      packageId: string;
      categories: { categoryName: string; basePrice: number; sortOrder: number; isShow: boolean }[];
      margin: number;
      sellingPrice: number;
    }) => savePackagePrices(packageId, categories, margin, sellingPrice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}

export function useUpdatePackageTC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, termAndCondition }: { packageId: string; termAndCondition: string | null }) =>
      updatePackageTC(packageId, termAndCondition),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });
}
