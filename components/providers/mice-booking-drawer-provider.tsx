"use client";

import { createContext, useContext, type ReactNode } from "react";
import { MiceBookingDrawer } from "@/app/(private)/dashboard/booking-mice/_components/MiceBookingDrawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface MiceBookingDrawerContextValue {
  openMiceBookingDrawer: (opts?: OpenDrawerOptions) => void;
}

const MiceBookingDrawerContext = createContext<MiceBookingDrawerContextValue | null>(null);

export function MiceBookingDrawerProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openDrawer, handleSuccess } = useDrawerController();

  return (
    <MiceBookingDrawerContext.Provider value={{ openMiceBookingDrawer: openDrawer }}>
      {children}
      {open && (
        <MiceBookingDrawer
          open={open}
          onOpenChange={setOpen}
          booking={null}
          onSuccess={handleSuccess}
        />
      )}
    </MiceBookingDrawerContext.Provider>
  );
}

export function useMiceBookingDrawer(): MiceBookingDrawerContextValue {
  const ctx = useContext(MiceBookingDrawerContext);
  if (!ctx) throw new Error("useMiceBookingDrawer must be used within MiceBookingDrawerProvider");
  return ctx;
}
