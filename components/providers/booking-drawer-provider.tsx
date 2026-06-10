"use client";

import { createContext, useContext, type ReactNode } from "react";
import { BookingDrawer } from "@/app/(private)/dashboard/booking-weddings/_components/booking-drawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface BookingDrawerContextValue {
  openBookingDrawer: (opts?: OpenDrawerOptions) => void;
}

const BookingDrawerContext = createContext<BookingDrawerContextValue | null>(null);

export function BookingDrawerProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openDrawer, handleSuccess, pendingDraftId, pendingResumeMode } = useDrawerController();

  return (
    <BookingDrawerContext.Provider value={{ openBookingDrawer: openDrawer }}>
      {children}
      {open && (
        <BookingDrawer
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
          initialDraftId={pendingResumeMode ? undefined : (pendingDraftId ?? null)}
          resumeDraftId={pendingResumeMode ? (pendingDraftId ?? null) : null}
        />
      )}
    </BookingDrawerContext.Provider>
  );
}

export function useBookingDrawer() {
  const ctx = useContext(BookingDrawerContext);
  if (!ctx) throw new Error("useBookingDrawer must be used within BookingDrawerProvider");
  return ctx;
}
