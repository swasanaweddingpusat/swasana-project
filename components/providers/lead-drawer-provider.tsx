"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { LeadDrawer } from "@/app/(private)/dashboard/leads/_components/lead-drawer";

interface LeadDrawerContextValue {
  openLeadDrawer: () => void;
}

const LeadDrawerContext = createContext<LeadDrawerContextValue | null>(null);

export function LeadDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openLeadDrawer = useCallback(() => setOpen(true), []);

  return (
    <LeadDrawerContext.Provider value={{ openLeadDrawer }}>
      {children}
      {open && <LeadDrawer open={open} onOpenChange={setOpen} editLead={null} />}
    </LeadDrawerContext.Provider>
  );
}

export function useLeadDrawer(): LeadDrawerContextValue {
  const ctx = useContext(LeadDrawerContext);
  if (!ctx) throw new Error("useLeadDrawer must be used within LeadDrawerProvider");
  return ctx;
}
