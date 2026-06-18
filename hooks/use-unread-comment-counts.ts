"use client";

import { useQuery } from "@tanstack/react-query";

interface UnreadCountsResponse {
  unreadCounts: Record<string, number>;
  mentionCounts: Record<string, number>;
}

export function useUnreadCommentCounts(bookingIds: string[]) {
  return useQuery({
    queryKey: ["unread-comments", bookingIds.join(",")],
    queryFn: async (): Promise<UnreadCountsResponse> => {
      if (!bookingIds.length) return { unreadCounts: {}, mentionCounts: {} };
      const res = await fetch("/api/bookings/unread-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds }),
      });
      if (!res.ok) return { unreadCounts: {}, mentionCounts: {} };
      return res.json() as Promise<UnreadCountsResponse>;
    },
    enabled: bookingIds.length > 0,
    refetchOnWindowFocus: false,
  });
}
