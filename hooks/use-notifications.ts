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
