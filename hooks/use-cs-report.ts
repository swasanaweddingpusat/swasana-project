"use client";

import { useQuery } from "@tanstack/react-query";

// Mirrors the server's 30s Bitrix cache fresh window (see use-bitrix-overview.ts).
export const CS_REPORT_QUERY_TTL_MS = 30_000;

export interface CsReportBucket {
  key: string;
  label: string;
  count: number;
}

export interface CsReportAdBucket {
  key: string;
  url: string;
  count: number;
}

export interface CsReportResponse {
  date: string;
  totalChatMasuk: number;
  chatJadiDatabase: number;
  databaseRespon: number;
  databaseNoRespon: number;
  spamPrank: number;
  adsSpam: CsReportAdBucket[];
  organikSpam: number;
  sources: CsReportBucket[];
  message: string;
  error?: string;
}

async function fetchCsReport(date: string): Promise<CsReportResponse> {
  const sp = new URLSearchParams();
  if (date) sp.set("date", date);
  const res = await fetch(`/api/bitrix/cs-report?${sp.toString()}`);
  const json = (await res.json().catch(() => null)) as CsReportResponse | null;
  if (!res.ok) {
    const err = new Error(json?.error ?? "Gagal memuat report chat CS.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as CsReportResponse;
}

/**
 * Cached, self-refreshing CS chat report query. `date` is an ISO day
 * ("2026-09-24"); pass "" to let the server default to yesterday.
 */
export function useCsReport(date: string, enabled = true) {
  return useQuery({
    queryKey: ["bitrix-cs-report", date],
    queryFn: () => fetchCsReport(date),
    enabled,
    staleTime: CS_REPORT_QUERY_TTL_MS,
    refetchInterval: CS_REPORT_QUERY_TTL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
