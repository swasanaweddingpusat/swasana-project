"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchHolidayTokenGrants } from "@/services/holiday-token-grant-service";
import { grantHolidayToken, revokeHolidayToken } from "@/actions/holidayToken";

export function useHolidayTokenGrants(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ["holiday-token-grants", params],
    queryFn: () => fetchHolidayTokenGrants(params),
    staleTime: 30 * 1000,
  });
}

export function useGrantHolidayToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof grantHolidayToken>[0]) => grantHolidayToken(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holiday-token-grants"] });
      qc.invalidateQueries({ queryKey: ["holiday-tokens"] });
    },
  });
}

export function useRevokeHolidayToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof revokeHolidayToken>[0]) => revokeHolidayToken(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holiday-token-grants"] });
      qc.invalidateQueries({ queryKey: ["holiday-tokens"] });
    },
  });
}
