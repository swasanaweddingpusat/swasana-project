"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDraftBooking,
  updateDraftBookingStep2,
  updateDraftBookingStep3,
  updateDraftBookingStep4,
  finalizeDraftBooking,
  getUserUnfinishedDraft,
  getDraftBookingDetail,
} from "@/actions/booking-draft";
import type {
  DraftResult,
  FinalizeDraftResult,
  UnfinishedDraft,
  DraftBookingDetail,
} from "@/actions/booking-draft";

// ─── Query: get full draft detail for resume prefill ─────────────────────────

export function useDraftBookingDetail(draftId: string | null | undefined) {
  return useQuery<DraftBookingDetail | null>({
    queryKey: ["booking-draft", "detail", draftId],
    queryFn: async () => {
      if (!draftId) return null;
      return getDraftBookingDetail(draftId);
    },
    enabled: !!draftId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

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
      // Finalizing a booking creates its approval record — refresh the approval
      // map so the approve button / status badge appear without a manual reload.
      void qc.invalidateQueries({ queryKey: ["booking-approvals"] });
    },
  });
}
