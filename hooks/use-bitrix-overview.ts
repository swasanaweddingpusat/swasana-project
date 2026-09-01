"use client";

import { useQuery } from "@tanstack/react-query";

// Bitrix reads are cached server-side with a 30s fresh window
// (lib/bitrix-cache.ts FRESH_WINDOW_MS). Mirror that on the client so the UI
// polls for fresh data every 30s without hammering Bitrix in between.
export const BITRIX_QUERY_TTL_MS = 30_000;

export interface Bucket {
  key: string;
  label: string;
  count: number;
}

export interface AdBucket {
  key: string;
  url: string;
  count: number;
}

export interface OverviewSalesBucket {
  key: string;
  label: string;
  count: number;
  getback: number;
  kantor: number;
  mandiri: number;
  responded: number;
  notResponded: number;
}

export interface StageCatalogItem {
  name: string;
  color: string;
  semantic: "won" | "lost" | "process";
  order: number;
}

export interface ResponseBySalesRow {
  userId: string;
  name: string;
  responded: number;
  notResponded: number;
}

export interface BitrixOverviewData {
  range: { from: string; to: string };
  total: number;
  kantor: number;
  mandiri: number;
  withVenue: number;
  organik: number;
  fromAds: number;
  spamPrank: number;
  sources: Bucket[];
  ads: AdBucket[];
  sales: OverviewSalesBucket[];
  venues: Bucket[];
  responseStatus: { responded: number; notResponded: number };
  responseBySales: ResponseBySalesRow[];
  stageCatalog: StageCatalogItem[];
  issueCatalog: string[];
  error?: string;
}

export interface BitrixOverviewParams {
  from: string;
  to: string;
  pipeline?: string;
  stage?: string;
  issue?: string;
  clientId?: string;
  salesId?: string;
  dbFrom?: string;
  dbTo?: string;
}

async function fetchBitrixOverview(params: BitrixOverviewParams): Promise<BitrixOverviewData> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const res = await fetch(`/api/bitrix/overview?${sp.toString()}`);
  const json = (await res.json().catch(() => null)) as BitrixOverviewData | null;
  if (!res.ok) {
    const err = new Error(json?.error ?? "Gagal memuat ringkasan.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as BitrixOverviewData;
}

/**
 * Cached, self-refreshing Bitrix Overview query. Serves cache for 30s, then
 * refetches (matching the server's 30s fresh window), and also polls every 30s
 * while the tab is focused.
 */
export function useBitrixOverview(params: BitrixOverviewParams, enabled = true) {
  return useQuery({
    queryKey: ["bitrix-overview", params],
    queryFn: () => fetchBitrixOverview(params),
    enabled: enabled && !!params.from,
    staleTime: BITRIX_QUERY_TTL_MS,
    refetchInterval: BITRIX_QUERY_TTL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
