import { useQuery } from "@tanstack/react-query";
import { fetchBookingComments } from "@/services/booking-comment-service";

export function useBookingComments(bookingId: string | null, highlightCommentId?: string) {
  return useQuery({
    queryKey: ["booking-comments", bookingId],
    queryFn: () => fetchBookingComments(bookingId!, highlightCommentId),
    enabled: !!bookingId,
    refetchOnWindowFocus: false,
  });
}
