"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { CustomersResult } from "@/lib/queries/customers";
import { createCustomer, updateCustomer, deleteCustomer, deleteBulkCustomers } from "@/actions/customer";
import type { CustomerInput, UpdateCustomerInput } from "@/lib/validations/customer";

interface CustomersParams {
  page: number;
  pageSize: number;
  search: string;
}

async function fetchCustomers(params: CustomersParams): Promise<CustomersResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
  });
  const res = await fetch(`/api/customers?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export function useCustomers(params: CustomersParams, initialData?: CustomersResult) {
  // SSR fetches page 1 / default pageSize / no search (see page.tsx) — initialData
  // is only a valid seed for that exact query; any other page/search must trigger
  // a real fetch instead of showing the SSR seed under different filters.
  const isDefaultQuery = params.page === 1 && params.pageSize === 10 && !params.search;
  return useQuery({
    queryKey: ["customers", params.page, params.pageSize, params.search],
    queryFn: () => fetchCustomers(params),
    initialData: isDefaultQuery ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerInput) => createCustomer(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCustomerInput) => updateCustomer(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
  });
}

export function useDeleteBulkCustomers() {
  return useMutation({
    mutationFn: (ids: string[]) => deleteBulkCustomers(ids),
  });
}
