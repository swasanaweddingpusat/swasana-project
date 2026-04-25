import { useQuery } from "@tanstack/react-query";

export function useUnreadCommentCounts(bookingIds: string[]) {
  return useQuery({
    queryKey: ["unread-comments", bookingIds.join(",")],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!bookingIds.length) return {};
      const res = await fetch("/api/bookings/unread-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds }),
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: bookingIds.length > 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });
}
