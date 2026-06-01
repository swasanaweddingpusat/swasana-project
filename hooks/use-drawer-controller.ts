"use client";

import { useState, useCallback, useRef } from "react";

export interface OpenDrawerOptions {
  /** Called after a successful create. Used e.g. to redirect to the list page. */
  onSuccess?: () => void;
}

export interface DrawerController {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: (opts?: OpenDrawerOptions) => void;
  /** Stable callback to hand to the drawer's `onSuccess` prop. */
  handleSuccess: () => void;
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

  const openDrawer = useCallback((opts?: OpenDrawerOptions) => {
    onSuccessRef.current = opts?.onSuccess;
    setOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    onSuccessRef.current?.();
  }, []);

  return { open, setOpen, openDrawer, handleSuccess };
}
