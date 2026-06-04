import type { BookingFinanceDetail } from "@/lib/queries/booking-finance-detail";

export async function getBookingFinanceDetailClient(
  bookingId: string,
): Promise<BookingFinanceDetail> {
  const res = await fetch(`/api/bookings/${bookingId}/finance-detail`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Gagal memuat detail keuangan booking.");
  }
  return res.json() as Promise<BookingFinanceDetail>;
}
