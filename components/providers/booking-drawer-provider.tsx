"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { BookingDrawer } from "@/app/(private)/dashboard/bookings/_components/booking-drawer";

interface BookingDrawerContextValue {
  openBookingDrawer: () => void;
}

const BookingDrawerContext = createContext<BookingDrawerContextValue | null>(null);

export function BookingDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openBookingDrawer = useCallback(() => setOpen(true), []);

  return (
    <BookingDrawerContext.Provider value={{ openBookingDrawer }}>
      {children}
      {open && <BookingDrawer open={open} onOpenChange={setOpen} />}
    </BookingDrawerContext.Provider>
  );
}

export function useBookingDrawer() {
  const ctx = useContext(BookingDrawerContext);
  if (!ctx) throw new Error("useBookingDrawer must be used within BookingDrawerProvider");
  return ctx;
}
