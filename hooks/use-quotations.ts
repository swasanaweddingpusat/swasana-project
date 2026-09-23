"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
} from "@/actions/quotation";
import type { QuotationsResult } from "@/lib/queries/quotations";
import type { CreateQuotationInput, UpdateQuotationInput } from "@/lib/validations/quotation";

interface QuotationsParams {
  page: number;
  pageSize: number;
  search: string;
  status?: string;
  category?: string;
}

async function fetchQuotations(params: QuotationsParams): Promise<QuotationsResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
  });
  const res = await fetch(`/api/quotations?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch quotations");
  return res.json();
}

export function useQuotations(params: QuotationsParams) {
  return useQuery({
    queryKey: ["quotations", params.page, params.pageSize, params.search, params.status, params.category],
    queryFn: () => fetchQuotations(params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuotationInput) => createQuotation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
    },
  });
}

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateQuotationInput) => updateQuotation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
    },
  });
}

export function useDeleteQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuotation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
    },
  });
}

export function useUpdateQuotationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateQuotation({ id, status } as UpdateQuotationInput),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
    },
  });
}
