import type { BookingDetail } from "@/lib/queries/bookings";

/**
 * Client fetcher for a single booking's full detail (used by the booking detail
 * modal + on-hover prefetch in the bookings table). Mirrors the GET
 * `/api/bookings/[id]` route, which returns the resolved booking object directly
 * (not wrapped). bigint fields arrive serialized as numbers — the BookingDetail
 * shape is kept for prop-compatibility with the existing modal consumers.
 */
export async function fetchBookingDetail(bookingId: string): Promise<BookingDetail> {
  const res = await fetch(`/api/bookings/${bookingId}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Gagal memuat data booking.");
  }
  return res.json() as Promise<BookingDetail>;
}
