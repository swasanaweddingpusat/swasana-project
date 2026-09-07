"use client";

import { useQuery } from "@tanstack/react-query";

export interface DashboardBookingItem {
  id: string;
  bookingStatus: string;
  category: string;
  eventDate: string | null;
  poNumber: string | null;
  customerName: string;
  venueName: string;
  salesName: string;
}

async function fetchDashboardBookings(
  dealFrom: string,
  dealTo: string,
  filter: string,
): Promise<DashboardBookingItem[]> {
  const qs = new URLSearchParams();
  qs.set("filter", filter);
  if (dealFrom) qs.set("dealFrom", dealFrom);
  if (dealTo) qs.set("dealTo", dealTo);
  const res = await fetch(`/api/dashboard/bookings?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard bookings");
  return res.json() as Promise<DashboardBookingItem[]>;
}

export function useDashboardBookings(
  dealFrom: string,
  dealTo: string,
  filter: string | null,
) {
  return useQuery({
    queryKey: ["dashboard-bookings", dealFrom, dealTo, filter],
    queryFn: () => fetchDashboardBookings(dealFrom, dealTo, filter!),
    enabled: !!filter,
    staleTime: 30_000,
  });
}
