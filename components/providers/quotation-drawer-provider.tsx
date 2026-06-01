"use client";

import { createContext, useContext, type ReactNode } from "react";
import { QuotationDrawer } from "@/app/(private)/dashboard/quotations/_components/quotation-drawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface QuotationDrawerContextValue {
  openQuotationDrawer: (opts?: OpenDrawerOptions) => void;
}

const QuotationDrawerContext = createContext<QuotationDrawerContextValue | null>(null);

export function QuotationDrawerProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openDrawer, handleSuccess } = useDrawerController();

  return (
    <QuotationDrawerContext.Provider value={{ openQuotationDrawer: openDrawer }}>
      {children}
      {open && (
        <QuotationDrawer
          open={open}
          onOpenChange={setOpen}
          editQuotation={null}
          onSuccess={handleSuccess}
        />
      )}
    </QuotationDrawerContext.Provider>
  );
}

export function useQuotationDrawer(): QuotationDrawerContextValue {
  const ctx = useContext(QuotationDrawerContext);
  if (!ctx) throw new Error("useQuotationDrawer must be used within QuotationDrawerProvider");
  return ctx;
}
