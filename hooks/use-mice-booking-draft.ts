"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDraftMiceBooking,
  updateDraftMiceStep2,
  updateDraftMiceStep3,
  finalizeDraftMiceBooking,
  getUserUnfinishedMiceDraft,
} from "@/actions/booking-mice-draft";
import type {
  MiceDraftResult,
  FinalizeMiceDraftResult,
} from "@/actions/booking-mice-draft";

// ─── Query: check for existing unfinished MICE draft ─────────────────────────

export function useUnfinishedMiceDraft(
  profileId: string | null | undefined,
) {
  return useQuery<{ id: string; customerName: string | null; venueName: string | null; createdAt: Date; updatedAt: Date } | null>({
    queryKey: ["mice-booking-draft", "unfinished", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      return getUserUnfinishedMiceDraft(profileId);
    },
    enabled: !!profileId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutation: create MICE draft (Step 1) ────────────────────────────────────

export function useCreateDraftMiceBooking() {
  return useMutation<MiceDraftResult, Error, unknown>({
    mutationFn: (data) => createDraftMiceBooking(data),
  });
}

// ─── Mutation: update MICE draft Step 2 (Terms) ──────────────────────────────

export function useUpdateMiceDraftStep2() {
  return useMutation<
    MiceDraftResult,
    Error,
    { draftId: string; data: unknown }
  >({
    mutationFn: ({ draftId, data }) => updateDraftMiceStep2(draftId, data),
  });
}

// ─── Mutation: update MICE draft Step 3 (Signature/Location) ─────────────────

export function useUpdateMiceDraftStep3() {
  return useMutation<
    MiceDraftResult,
    Error,
    { draftId: string; data: unknown }
  >({
    mutationFn: ({ draftId, data }) => updateDraftMiceStep3(draftId, data),
  });
}

// ─── Mutation: finalize MICE draft ───────────────────────────────────────────

export function useFinalizeDraftMiceBooking() {
  const qc = useQueryClient();
  return useMutation<FinalizeMiceDraftResult, Error, unknown>({
    mutationFn: (data) => finalizeDraftMiceBooking(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["mice-booking-draft"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
