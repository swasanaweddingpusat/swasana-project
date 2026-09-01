"use client";

import { useQuery } from "@tanstack/react-query";
import type { DealingSummary } from "@/lib/queries/bookings";
import { BITRIX_QUERY_TTL_MS } from "./use-bitrix-overview";

export type { DealingSummary } from "@/lib/queries/bookings";

async function fetchDealingSummary(from: string, to: string): Promise<DealingSummary> {
  const sp = new URLSearchParams({ from, to });
  const res = await fetch(`/api/dealing/summary?${sp.toString()}`);
  const json = (await res.json().catch(() => null)) as (DealingSummary & { error?: string }) | null;
  if (!res.ok) {
    const err = new Error(json?.error ?? "Gagal memuat ringkasan dealing.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as DealingSummary;
}

/**
 * Cached, self-refreshing "Jumlah Dealing" summary (Postgres booking). Shares
 * the 30s cadence with the Bitrix overview so both cards refresh together.
 */
export function useDealingSummary(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["dealing-summary", from, to],
    queryFn: () => fetchDealingSummary(from, to),
    enabled: enabled && !!from,
    staleTime: BITRIX_QUERY_TTL_MS,
    refetchInterval: BITRIX_QUERY_TTL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
