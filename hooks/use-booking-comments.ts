import { useQuery } from "@tanstack/react-query";
import { fetchBookingComments } from "@/services/booking-comment-service";

export function useBookingComments(bookingId: string | null) {
  return useQuery({
    queryKey: ["booking-comments", bookingId],
    queryFn: () => fetchBookingComments(bookingId!),
    enabled: !!bookingId,
    refetchOnWindowFocus: false,
  });
}
