"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchComplimentaries,
  type ComplimentaryListResult,
} from "@/services/complimentary-service";

export function useComplimentaries(
  params: { search?: string; activeOnly?: boolean; page?: number; pageSize?: number } = {}
) {
  return useQuery<ComplimentaryListResult>({
    queryKey: ["complimentaries", params],
    queryFn: () => fetchComplimentaries(params),
    staleTime: 5 * 60_000,
  });
}
