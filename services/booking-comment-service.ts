import type { BookingCommentItem } from "@/lib/queries/booking-comments";

export async function fetchBookingComments(bookingId: string, highlightCommentId?: string): Promise<BookingCommentItem[]> {
  const qs = highlightCommentId ? `?highlight=${encodeURIComponent(highlightCommentId)}` : "";
  const res = await fetch(`/api/bookings/${bookingId}/comments${qs}`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}
