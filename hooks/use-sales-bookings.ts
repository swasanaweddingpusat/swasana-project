"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { BookingsResult, ApprovalStatusFilter } from "@/lib/queries/bookings";
import type { BookingStatus } from "@prisma/client";

export interface UseSalesBookingsParams {
  salesId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  venueId?: string;
  recordStatus?: "saved" | "draft" | "all";
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  approvalStatus?: ApprovalStatusFilter;
  bookingStatus?: BookingStatus;
  sourceOfInformationId?: string;
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
    ...(p.year ? { year: String(p.year) } : {}),
    ...(p.approvalStatus ? { approvalStatus: p.approvalStatus } : {}),
    ...(p.bookingStatus ? { bookingStatus: p.bookingStatus } : {}),
    ...(p.sourceOfInformationId ? { sourceOfInformationId: p.sourceOfInformationId } : {}),
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
  const year = p.year ?? "";
  const approvalStatus = p.approvalStatus ?? "";
  const bookingStatus = p.bookingStatus ?? "";
  const sourceOfInformationId = p.sourceOfInformationId ?? "";

  return useQuery({
    queryKey: ["bookings", "sales", p.salesId, page, pageSize, search, venueId, recordStatus, dateFrom, dateTo, year, approvalStatus, bookingStatus, sourceOfInformationId],
    queryFn: () => fetchSalesBookings(p),
    enabled: (p.enabled ?? true) && !!p.salesId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
