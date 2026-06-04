"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDraftBooking,
  updateDraftBookingStep2,
  updateDraftBookingStep3,
  updateDraftBookingStep4,
  finalizeDraftBooking,
  getUserUnfinishedDraft,
} from "@/actions/booking-draft";
import type {
  DraftResult,
  FinalizeDraftResult,
  UnfinishedDraft,
} from "@/actions/booking-draft";

// ─── Query: check for existing unfinished draft ───────────────────────────────

export function useUnfinishedDraft(
  profileId: string | null | undefined,
  category: "WEDDINGS" | "MICE" = "WEDDINGS",
) {
  return useQuery<UnfinishedDraft | null>({
    queryKey: ["booking-draft", "unfinished", profileId, category],
    queryFn: async () => {
      if (!profileId) return null;
      return getUserUnfinishedDraft(profileId, category);
    },
    enabled: !!profileId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ─── Mutation: create draft (Step 1) ─────────────────────────────────────────

export function useCreateDraftBooking() {
  return useMutation<DraftResult, Error, unknown>({
    mutationFn: (data) => createDraftBooking(data),
  });
}

// ─── Mutation: update draft Step 2 ───────────────────────────────────────────

export function useUpdateDraftStep2() {
  return useMutation<
    DraftResult,
    Error,
    { draftId: string; data: unknown }
  >({
    mutationFn: ({ draftId, data }) => updateDraftBookingStep2(draftId, data),
  });
}

// ─── Mutation: update draft Step 3 ───────────────────────────────────────────

export function useUpdateDraftStep3() {
  return useMutation<
    DraftResult,
    Error,
    { draftId: string; data: unknown }
  >({
    mutationFn: ({ draftId, data }) => updateDraftBookingStep3(draftId, data),
  });
}

// ─── Mutation: update draft Step 4 ───────────────────────────────────────────

export function useUpdateDraftStep4() {
  return useMutation<
    DraftResult,
    Error,
    { draftId: string; data: unknown }
  >({
    mutationFn: ({ draftId, data }) => updateDraftBookingStep4(draftId, data),
  });
}

// ─── Mutation: finalize draft ─────────────────────────────────────────────────

export function useFinalizeDraftBooking() {
  const qc = useQueryClient();
  return useMutation<FinalizeDraftResult, Error, unknown>({
    mutationFn: (data) => finalizeDraftBooking(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["booking-draft"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
