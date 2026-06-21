"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CreateLeadDrawer } from "@/app/(private)/dashboard/leads/_components/CreateLeadDrawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface LeadDrawerContextValue {
  openLeadDrawer: (opts?: OpenDrawerOptions) => void;
}

const LeadDrawerContext = createContext<LeadDrawerContextValue | null>(null);

export function LeadDrawerProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openDrawer, handleSuccess } = useDrawerController();

  return (
    <LeadDrawerContext.Provider value={{ openLeadDrawer: openDrawer }}>
      {children}
      {open && (
        <CreateLeadDrawer
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
        />
      )}
    </LeadDrawerContext.Provider>
  );
}

export function useLeadDrawer(): LeadDrawerContextValue {
  const ctx = useContext(LeadDrawerContext);
  if (!ctx) throw new Error("useLeadDrawer must be used within LeadDrawerProvider");
  return ctx;
}
