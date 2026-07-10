import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWeddingIndicators,
  fetchWeddingIndicatorById,
  fetchShareStatus,
} from "@/services/weddingIndicatorService";
import {
  createWeddingIndicator,
  updateWeddingIndicator,
  deleteWeddingIndicator,
} from "@/actions/weddingIndicator";
import {
  generateShareLink,
  revokeShareLink,
} from "@/actions/weddingIndicatorShare";
import { WeddingIndicatorFilters } from "@/lib/validations/weddingIndicator";

export function useWeddingIndicators(filters: WeddingIndicatorFilters) {
  return useQuery({
    queryKey: [
      "wedding-indicators",
      filters.page,
      filters.limit,
      filters.search ?? null,
      filters.venueId ?? null,
      filters.dateFrom?.toISOString() ?? null,
      filters.dateTo?.toISOString() ?? null,
    ],
    queryFn: () => fetchWeddingIndicators(filters),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useWeddingIndicatorDetail(id: string) {
  return useQuery({
    queryKey: ["wedding-indicator", id],
    queryFn: () => fetchWeddingIndicatorById(id),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!id,
  });
}

export function useShareStatus(indicatorId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["wedding-indicator-share-status", indicatorId],
    queryFn: () => fetchShareStatus(indicatorId),
    enabled,
  });
}

export function useGenerateShareLink(indicatorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateShareLink(indicatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wedding-indicator-share-status", indicatorId],
      });
    },
  });
}

export function useRevokeShareLink(indicatorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeShareLink(indicatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wedding-indicator-share-status", indicatorId],
      });
    },
  });
}

export function useCreateWeddingIndicator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => createWeddingIndicator(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wedding-indicators"] });
    },
  });
}

export function useUpdateWeddingIndicator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      updateWeddingIndicator(id, formData),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["wedding-indicators"] });
      queryClient.invalidateQueries({ queryKey: ["wedding-indicator", id] });
    },
  });
}

export function useDeleteWeddingIndicator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWeddingIndicator(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wedding-indicators"] });
    },
  });
}
