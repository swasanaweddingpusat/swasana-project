"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CloseCircle } from "@solar-icons/react";
import React from "react";
import { Stepper } from "@/components/ui/stepper";

interface DrawerProps {
  isOpen: boolean;
  onClose?: () => void;
  isCloseButton?: boolean;
  /** When true, pressing Escape will NOT close the drawer (used for lockable flows). */
  disableEscapeDismissal?: boolean;
  title: string;
  children: React.ReactNode;
  steps?: number;
  totalSteps?: number;
  maxWidth?: string;
  stepperType?: "short" | "long";
  stepperSteps?: Array<{
    id: number;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  onBack?: () => void;
  backButtonLabel?: string;
  headerActions?: React.ReactNode;
  childrenClassName?: string;
  /** Horizontal padding of the sheet body (header + content). Defaults to "px-5".
   *  Pass a tighter value (e.g. "px-2") for content-dense drawers that need width. */
  paddingX?: string;
}

export function Drawer({
  isOpen,
  onClose,
  isCloseButton = true,
  disableEscapeDismissal = false,
  title,
  steps,
  totalSteps = 2,
  children,
  maxWidth = "sm:max-w-md",
  stepperType = "short",
  stepperSteps,
  onBack,
  backButtonLabel = "Back",
  headerActions,
  childrenClassName,
  paddingX = "px-5",
}: DrawerProps) {
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open, eventDetails) => {
        // base-ui Dialog: `disablePointerDismissal` only blocks outside-click, not Escape.
        // When locked, cancel the Escape-key close so the drawer cannot be dismissed.
        if (!open && disableEscapeDismissal && eventDetails.reason === "escape-key") {
          eventDetails.cancel();
          return;
        }
        if (!open) onClose?.();
      }}
      disablePointerDismissal
    >
      <SheetContent
        className={cn(
          `flex py-6 flex-col gap-6`,
          paddingX,
          maxWidth.includes("max-w-full")
            ? "inset-0 max-w-none! w-full! border-none"
            : `w-screen! ${maxWidth}`
        )}
        showCloseButton={false}
      >
        {/* Header with title, close button, and steps */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base sm:text-[22px] font-semibold px-2 m-0 text-foreground truncate max-w-[60%]">
              {title}
            </SheetTitle>
            <div className="flex items-center gap-3">
              {steps && stepperType === "short" && (
                <>
                  <span className="text-sm text-muted-foreground">
                    Step {steps} / {totalSteps}
                  </span>
                  <button
                    className="p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 cursor-pointer"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-destructive" />
                  </button>
                </>
              )}
              {headerActions}
              {isCloseButton && !steps && (
                <button
                  className="p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 cursor-pointer"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-destructive" />
                </button>
              )}
            </div>
          </div>
          {/* Back button */}
          {onBack && (
            <div className="flex items-center px-2">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backButtonLabel}
              </button>
            </div>
          )}
        </div>

        {/* Long stepper - positioned below title */}
        {stepperType === "long" && steps && stepperSteps && (
          <Stepper currentStep={steps} steps={stepperSteps} />
        )}

        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", childrenClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
