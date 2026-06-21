"use client";

import { useQuery } from "@tanstack/react-query";
import type { VenueAvailability } from "@/app/api/venues/[id]/availability/route";

/**
 * useVenueAvailability — fetch per-venue slot availability for a given month.
 *
 * Merges bookings + locked leads (both primary + secondary venue) into a single
 * Record<"YYYY-MM-DD", { morning, evening, fullday }> map.
 *
 * @param venueId       - ID venue yang dicek. Pass null/undefined buat skip fetch.
 * @param month         - Format "YYYY-MM". Defaults to current month if omitted.
 * @param excludeId     - Booking ID to exclude from check (edit mode).
 * @param excludeLeadId - Lead ID to exclude from locked-lead check (Deal modal:
 *                        the lead being converted should not block its own slot).
 */
export function useVenueAvailability(
  venueId: string | null | undefined,
  month?: string,
  excludeId?: string,
  excludeLeadId?: string,
) {
  const targetMonth =
    month ??
    (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    })();

  return useQuery<VenueAvailability>({
    queryKey: ["venue-availability", venueId, targetMonth, excludeId ?? null, excludeLeadId ?? null] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ month: targetMonth });
      if (excludeId) params.set("exclude", excludeId);
      if (excludeLeadId) params.set("excludeLeadId", excludeLeadId);
      const res = await fetch(`/api/venues/${venueId}/availability?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch venue availability");
      return res.json();
    },
    // Only run if venueId is provided
    enabled: Boolean(venueId),
    // Cache for 2 minutes — balance freshness vs request rate
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Derive availability status for a single date from availability map.
 *
 * @param availability - VenueAvailability map from useVenueAvailability
 * @param dateStr      - "YYYY-MM-DD" string
 * @param session      - optional: if provided, check only that session; else check "can any session be booked"
 * @returns "available" | "partial" | "unavailable" | null (null when date or map not provided)
 */
export function getDateAvailabilityStatus(
  availability: VenueAvailability | null | undefined,
  dateStr: string | null | undefined,
  session?: "morning" | "evening" | "fullday" | null,
): "available" | "partial" | "unavailable" | null {
  if (!availability || !dateStr) return null;
  const slot = availability[dateStr];
  if (!slot) return null;

  if (session) {
    // Check specific session
    if (session === "fullday") {
      return slot.morning && slot.evening && slot.fullday ? "available" : "unavailable";
    }
    return slot[session] ? "available" : "unavailable";
  }

  // No session specified — derive overall status
  const total = (slot.morning ? 1 : 0) + (slot.evening ? 1 : 0);
  if (total === 2) return "available";
  if (total === 0) return "unavailable";
  return "partial";
}
