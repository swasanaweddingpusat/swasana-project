"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DailyActivitySegmentItem } from "@/lib/queries/daily-activity";

async function fetchDailyActivitySegments(): Promise<DailyActivitySegmentItem[]> {
  const res = await fetch("/api/daily-activity-segments");
  if (!res.ok) throw new Error("Failed to fetch daily activity segments");
  return res.json();
}

export function useDailyActivitySegments() {
  return useQuery({
    queryKey: ["daily-activity-segments"] as const,
    queryFn: fetchDailyActivitySegments,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

async function createDailyActivitySegment(body: {
  name: string;
  isActive: boolean;
  sortOrder: number;
}): Promise<DailyActivitySegmentItem> {
  const res = await fetch("/api/daily-activity-segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal membuat segment");
  }
  return res.json();
}

async function updateDailyActivitySegment(id: string, body: Partial<{
  name: string;
  isActive: boolean;
  sortOrder: number;
}>): Promise<DailyActivitySegmentItem> {
  const res = await fetch(`/api/daily-activity-segments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal mengupdate segment");
  }
  return res.json();
}

async function deleteDailyActivitySegment(id: string): Promise<void> {
  const res = await fetch(`/api/daily-activity-segments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus segment");
  }
}

export function useCreateDailyActivitySegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDailyActivitySegment,
    onSuccess: (created) => {
      // Inject the authoritative row straight into the cache instead of relying on
      // a refetch. The GET route reads a server "use cache" helper, so an immediate
      // refetch can race the tag revalidation and re-hydrate a stale snapshot —
      // which is why the new segment only appeared after a hard refresh.
      qc.setQueryData<DailyActivitySegmentItem[]>(["daily-activity-segments"], (prev) => {
        const list = prev ?? [];
        if (list.some((s) => s.id === created.id)) return list;
        return [...list, created].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      // Mark stale so the ordering reconciles on the next natural refetch,
      // but do not refetch now (would clobber the fresh row with a stale read).
      qc.invalidateQueries({ queryKey: ["daily-activity-segments"], refetchType: "none" });
    },
  });
}

export function useUpdateDailyActivitySegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateDailyActivitySegment>[1]) =>
      updateDailyActivitySegment(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activity-segments"] }),
  });
}

export function useDeleteDailyActivitySegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDailyActivitySegment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activity-segments"] }),
  });
}
