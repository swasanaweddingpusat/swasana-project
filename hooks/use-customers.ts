"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomersResult } from "@/lib/queries/customers";
import { createCustomer, updateCustomer, deleteCustomer } from "@/actions/customer";
import type { CustomerInput, UpdateCustomerInput } from "@/lib/validations/customer";

async function fetchCustomers(): Promise<CustomersResult> {
  const res = await fetch("/api/customers");
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export function useCustomers(initialData?: CustomersResult) {
  return useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
    initialData,
    staleTime: 5 * 60 * 1000,
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
