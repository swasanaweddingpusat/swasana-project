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
}

export function Drawer({
  isOpen,
  onClose,
  isCloseButton = true,
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
}: DrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <SheetContent
        className={cn(
          `flex py-6 px-5 flex-col gap-6`,
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
                    className="p-1 rounded-full bg-muted hover:bg-muted/80 cursor-pointer"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-foreground" />
                  </button>
                </>
              )}
              {headerActions}
              {isCloseButton && !steps && (
                <button
                  className="p-1 rounded-full bg-muted hover:bg-muted/80 cursor-pointer"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-foreground" />
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

        <div className={cn("flex-1 overflow-y-auto", childrenClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
