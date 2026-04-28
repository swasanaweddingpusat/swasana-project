"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookingsResult, BookingDetail } from "@/lib/queries/bookings";
import { createBooking, updateBooking, deleteBooking, transferBooking } from "@/actions/booking";
import type { BookingInput, UpdateBookingInput } from "@/lib/validations/booking";

async function fetchBookings(): Promise<BookingsResult> {
  const res = await fetch("/api/bookings");
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

export function useBookings(initialData?: BookingsResult) {
  return useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
    initialData,
    staleTime: 5 * 60 * 1000,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateBookingInput) => updateBooking(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
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
