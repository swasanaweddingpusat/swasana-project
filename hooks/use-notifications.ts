"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationItem } from "@/lib/queries/notifications";

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  unreadMentionCount: number;
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications");
  if (!res.ok) return { notifications: [], unreadCount: 0, unreadMentionCount: 0 };
  return res.json() as Promise<NotificationsResponse>;
}

/**
 * Resolve where a notification should navigate on click. Single source of truth
 * shared by the header bell and the full notifications page so both deep-link
 * consistently. Returns `null` when there's nowhere sensible to go.
 */
export function notificationHref(n: NotificationItem): string | null {
  // Comment mention → open the booking's detail page with the comment panel + highlight.
  if (n.type === "comment_mention" && n.entityId) {
    const params = new URLSearchParams({ openComments: "true" });
    if (n.commentId) params.set("highlightComment", n.commentId);
    return `/booking/booking-weddings/${n.entityId}?${params.toString()}`;
  }
  // Wedding booking → deep-link straight to its standalone detail page.
  if (n.entityType === "booking" && n.entityId) {
    return `/booking/booking-weddings/${n.entityId}`;
  }
  // MICE booking has no detail page yet → land on the MICE list.
  if (n.entityType === "booking-mice") return "/booking/booking-mice";
  // Booking notification without an id → fall back to the wedding list.
  if (n.entityType === "booking") return "/booking/booking-weddings";
  return null;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
