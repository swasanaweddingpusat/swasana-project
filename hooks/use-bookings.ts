"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { BookingsResult, BookingDetail } from "@/lib/queries/bookings";
import { createBooking, updateBooking, deleteBooking, transferBooking, transferBookingManager } from "@/actions/booking";
import type { BookingInput, UpdateBookingInput } from "@/lib/validations/booking";

interface BookingsParams {
  page: number;
  pageSize: number;
  search: string;
  venueId?: string;
  recordStatus?: "saved" | "draft" | "all";
  dateFrom?: string;
  dateTo?: string;
  year?: number;
  approvalStatus?: "pending" | "approved";
  salesId?: string;
}

async function fetchBookings(params: BookingsParams): Promise<BookingsResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.venueId ? { venueId: params.venueId } : {}),
    ...(params.recordStatus ? { recordStatus: params.recordStatus } : {}),
    ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
    ...(params.dateTo ? { dateTo: params.dateTo } : {}),
    ...(params.year ? { year: String(params.year) } : {}),
    ...(params.approvalStatus ? { approvalStatus: params.approvalStatus } : {}),
    ...(params.salesId ? { salesId: params.salesId } : {}),
  });
  const res = await fetch(`/api/bookings?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

export function useBookings(params: BookingsParams, initialData?: BookingsResult) {
  // SSR fetches with NO year filter (see page.tsx) — initialData is "all years,
  // page 1, default filters". It is only a valid seed when the client query also
  // has no year filter; any explicit year must trigger a real fetch, otherwise the
  // list would show all years while the dropdown says a specific year until
  // staleTime elapses (refetchOnMount is off).
  const isDefaultQuery =
    params.page === 1 &&
    !params.search &&
    !params.venueId &&
    (!params.recordStatus || params.recordStatus === "saved") &&
    !params.dateFrom &&
    !params.dateTo &&
    params.year === undefined &&
    !params.approvalStatus &&
    !params.salesId;
  return useQuery({
    queryKey: ["bookings", params.page, params.pageSize, params.search, params.venueId, params.recordStatus ?? "saved", params.dateFrom ?? "", params.dateTo ?? "", params.year ?? "", params.approvalStatus ?? "", params.salesId ?? ""],
    queryFn: () => fetchBookings(params),
    initialData: isDefaultQuery ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useBookingDetail(id: string) {
  return useQuery<BookingDetail | null>({
    queryKey: ["bookings", id],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${id}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BookingInput) => createBooking(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateBookingInput) => updateBooking(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBooking(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useTransferBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, targetSalesId }: { bookingId: string; targetSalesId: string }) =>
      transferBooking(bookingId, targetSalesId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useTransferBookingManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, targetManagerId }: { bookingId: string; targetManagerId: string }) =>
      transferBookingManager(bookingId, targetManagerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}
