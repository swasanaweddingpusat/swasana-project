import type { BookingCommentItem } from "@/lib/queries/booking-comments";

export async function fetchBookingComments(bookingId: string): Promise<BookingCommentItem[]> {
  const res = await fetch(`/api/bookings/${bookingId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}
