"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { BookingsResult } from "@/lib/queries/bookings";

export interface UseSalesBookingsParams {
  salesId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  venueId?: string;
  recordStatus?: "saved" | "draft" | "all";
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean;
}

async function fetchSalesBookings(p: UseSalesBookingsParams): Promise<BookingsResult> {
  const qs = new URLSearchParams({
    salesId: p.salesId,
    page: String(p.page ?? 1),
    pageSize: String(p.pageSize ?? 10),
    recordStatus: p.recordStatus ?? "saved",
    ...(p.search ? { search: p.search } : {}),
    ...(p.venueId ? { venueId: p.venueId } : {}),
    ...(p.dateFrom ? { dateFrom: p.dateFrom } : {}),
    ...(p.dateTo ? { dateTo: p.dateTo } : {}),
  });
  const res = await fetch(`/api/bookings?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch sales bookings");
  return res.json() as Promise<BookingsResult>;
}

export function useSalesBookings(p: UseSalesBookingsParams) {
  const page = p.page ?? 1;
  const pageSize = p.pageSize ?? 10;
  const search = p.search ?? "";
  const venueId = p.venueId ?? "";
  const recordStatus = p.recordStatus ?? "saved";
  const dateFrom = p.dateFrom ?? "";
  const dateTo = p.dateTo ?? "";

  return useQuery({
    queryKey: ["bookings", "sales", p.salesId, page, pageSize, search, venueId, recordStatus, dateFrom, dateTo],
    queryFn: () => fetchSalesBookings(p),
    enabled: (p.enabled ?? true) && !!p.salesId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
