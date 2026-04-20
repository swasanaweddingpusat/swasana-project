"use client";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { X } from "lucide-react";
import React from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose?: () => void;
  isCloseButton?: boolean;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  headerActions?: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  isCloseButton = true,
  title,
  children,
  maxWidth = "sm:max-w-md",
  headerActions,
}: DrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <SheetContent
        className={`w-full ${maxWidth} flex py-6 px-5 flex-col gap-6`}
        showCloseButton={false}
      >
        {/* Header */}
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

        <div className="flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
