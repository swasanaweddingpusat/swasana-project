"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { BookingActivityLogResult, BookingLogCategory } from "@/lib/queries/booking-log";

interface BookingLogParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: BookingLogCategory;
  dateFrom?: string;
  dateTo?: string;
}

async function fetchBookingLogs(params: BookingLogParams): Promise<BookingActivityLogResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
    ...(params.dateTo ? { dateTo: params.dateTo } : {}),
  });
  const res = await fetch(`/api/booking-logs?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch booking activity logs");
  return res.json();
}

export function useBookingLogs(params: BookingLogParams, initialData?: BookingActivityLogResult) {
  const isDefaultQuery =
    params.page === 1 && !params.search && !params.category && !params.dateFrom && !params.dateTo;

  return useQuery({
    queryKey: ["booking-logs", params.page, params.pageSize, params.search ?? "", params.category ?? "", params.dateFrom ?? "", params.dateTo ?? ""],
    queryFn: () => fetchBookingLogs(params),
    initialData: isDefaultQuery ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
