"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PollData } from "@/lib/queries/poll";

async function fetchPoll(): Promise<PollData> {
  const res = await fetch("/api/poll/bookings");
  if (!res.ok) throw new Error("Poll failed");
  return res.json();
}

export function usePoll(): { notificationCount: number } {
  const qc = useQueryClient();
  const prevRef = useRef<PollData | null>(null);

  const { data } = useQuery({
    queryKey: ["poll"],
    queryFn: fetchPoll,
    // Pause polling while the tab is hidden — no point hammering Neon in the
    // background. Re-evaluates to 30s once the tab becomes visible again.
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? false : 30_000,
    // Refetch once on tab refocus so the notification bell is fresh after idle.
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!data) return;
    const prev = prevRef.current;
    prevRef.current = data;
    if (!prev) return;

    if (prev.bookingsUpdatedAt !== data.bookingsUpdatedAt) {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    }

    if (prev.latestCommentAt !== data.latestCommentAt) {
      qc.invalidateQueries({ queryKey: ["booking-comments"] });
      qc.invalidateQueries({ queryKey: ["unread-comments"] });
    }

    if (prev.notificationCount !== data.notificationCount) {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [data, qc]);

  return { notificationCount: data?.notificationCount ?? 0 };
}
