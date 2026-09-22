"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBonuses, type BonusListResult } from "@/services/bonus-service";
import { createBonus, updateBonus, deleteBonus } from "@/actions/bonus";
import type { CreateBonusInput, UpdateBonusInput } from "@/lib/validations/bonus";

export function useBonuses(
  params: { search?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}
) {
  return useQuery<BonusListResult>({
    queryKey: ["bonuses", params],
    queryFn: () => fetchBonuses(params),
    staleTime: 5 * 60_000,
  });
}

export function useCreateBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBonusInput) => createBonus(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonuses"] }),
  });
}

export function useUpdateBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBonusInput }) => updateBonus(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonuses"] }),
  });
}

export function useDeleteBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBonus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonuses"] }),
  });
}
