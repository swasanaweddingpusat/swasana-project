"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CreateDailyActivityDrawer } from "@/app/(private)/dashboard/daily-activity/_components/CreateDailyActivityDrawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface DailyActivityDrawerContextValue {
  openDailyActivityDrawer: (opts?: OpenDrawerOptions) => void;
}

const DailyActivityDrawerContext = createContext<DailyActivityDrawerContextValue | null>(null);

export function DailyActivityDrawerProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openDrawer, handleSuccess } = useDrawerController();

  return (
    <DailyActivityDrawerContext.Provider value={{ openDailyActivityDrawer: openDrawer }}>
      {children}
      {open && (
        <CreateDailyActivityDrawer
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
        />
      )}
    </DailyActivityDrawerContext.Provider>
  );
}

export function useDailyActivityDrawer(): DailyActivityDrawerContextValue {
  const ctx = useContext(DailyActivityDrawerContext);
  if (!ctx) throw new Error("useDailyActivityDrawer must be used within DailyActivityDrawerProvider");
  return ctx;
}
