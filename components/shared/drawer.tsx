"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { X } from "lucide-react";
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
}: DrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <SheetContent
        className={`w-full ${maxWidth} flex py-6 px-5 flex-col gap-6`}
        showCloseButton={false}
      >
        {/* Header with title, close button, and steps */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base sm:text-[22px] font-semibold px-2 m-0 text-[#121417] truncate max-w-[60%]">
              {title}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {headerActions}
              {isCloseButton && (
                <button
                  className="p-1 rounded-full bg-red-100 hover:bg-red-200 cursor-pointer"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-6 w-6 text-red-500" />
                </button>
              )}
            </div>
          </div>
          {/* Back button and Steps in same row */}
          {(onBack || (steps && stepperType === "short")) && (
            <div className="flex items-center justify-between px-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {backButtonLabel}
                </button>
              ) : <div />}
              {steps && stepperType === "short" && (
                <span className="text-base text-[#121417]">
                  Step {steps} / {totalSteps}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Long stepper - positioned below title */}
        {stepperType === "long" && steps && stepperSteps && (
          <Stepper currentStep={steps} steps={stepperSteps} />
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
