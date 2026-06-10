"use client";

import { useState, useCallback, useRef } from "react";

export interface OpenDrawerOptions {
  /** Called after a successful create. Used e.g. to redirect to the list page. */
  onSuccess?: () => void;
  /**
   * When set, the drawer opens pre-loaded with this draft ID.
   * Combine with `resumeMode: true` to use the data-driven resume flow
   * (step determined by draft data). Without `resumeMode`, the Deal flow
   * is used instead (forces step 3).
   */
  initialDraftId?: string;
  /**
   * When true together with `initialDraftId`, the drawer uses the
   * data-driven resume path (same logic as the in-drawer resume prompt)
   * instead of the Deal-flow forced step-3 jump.
   */
  resumeMode?: boolean;
}

export interface DrawerController {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: (opts?: OpenDrawerOptions) => void;
  /** Stable callback to hand to the drawer's `onSuccess` prop. */
  handleSuccess: () => void;
  /** The draft ID (if any) passed to the most recent `openDrawer` call. */
  pendingDraftId: string | undefined;
  /** Whether the pending open is in resume-mode (data-driven step). */
  pendingResumeMode: boolean;
}

/**
 * Shared state machine for the global "create" drawers (lead, quotation,
 * booking). Keeps an open flag plus the per-open `onSuccess` callback so a
 * single drawer instance can be triggered from anywhere (header, mobile nav,
 * tables) with caller-specific post-submit behavior.
 */
export function useDrawerController(): DrawerController {
  const [open, setOpen] = useState(false);
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);
  const [pendingDraftId, setPendingDraftId] = useState<string | undefined>(undefined);
  const [pendingResumeMode, setPendingResumeMode] = useState(false);

  const openDrawer = useCallback((opts?: OpenDrawerOptions) => {
    onSuccessRef.current = opts?.onSuccess;
    setPendingDraftId(opts?.initialDraftId);
    setPendingResumeMode(opts?.resumeMode ?? false);
    setOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    onSuccessRef.current?.();
  }, []);

  return { open, setOpen, openDrawer, handleSuccess, pendingDraftId, pendingResumeMode };
}
