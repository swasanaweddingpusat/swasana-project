"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createMiceBooking,
  updateMiceBooking,
  deleteMiceBooking,
  markMiceLost,
} from "@/actions/booking-mice";
import type {
  CreateMiceBookingInput,
  UpdateMiceBookingInput,
  MarkMiceLostInput,
} from "@/lib/validations/booking-mice";
import type { MiceBookingsResponse } from "@/app/(private)/booking/booking-mice/_components/types";

interface MiceFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

async function fetchMiceBookings(filter: MiceFilter = {}): Promise<MiceBookingsResponse> {
  const params = new URLSearchParams();
  if (filter.page) params.set("page", String(filter.page));
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
  if (filter.search) params.set("search", filter.search);
  if (filter.status && filter.status !== "all") params.set("status", filter.status);

  const res = await fetch(`/api/booking-mice?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch MICE bookings");
  return res.json() as Promise<MiceBookingsResponse>;
}

interface SalesMiceOption {
  id: string;
  fullName: string | null;
}

async function fetchSalesMice(): Promise<SalesMiceOption[]> {
  const res = await fetch("/api/sales-mice");
  if (!res.ok) return [];
  return res.json() as Promise<SalesMiceOption[]>;
}

export function useMiceBookings(filter: MiceFilter = {}) {
  return useQuery({
    queryKey: ["mice-bookings", filter] as const,
    queryFn: () => fetchMiceBookings(filter),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useSalesMice(enabled: boolean) {
  return useQuery({
    queryKey: ["sales-mice"] as const,
    queryFn: fetchSalesMice,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCreateMiceBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMiceBookingInput) => createMiceBooking(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mice-bookings"] }),
  });
}

export function useUpdateMiceBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMiceBookingInput) => updateMiceBooking(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mice-bookings"] }),
  });
}

export function useDeleteMiceBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMiceBooking(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mice-bookings"] }),
  });
}

export function useMarkMiceLost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkMiceLostInput) => markMiceLost(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mice-bookings"] }),
  });
}
