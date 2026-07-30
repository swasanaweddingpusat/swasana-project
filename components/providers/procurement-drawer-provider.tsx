"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AddProcurementDrawer } from "@/app/(private)/dashboard/pengadaan-barang/_components/AddProcurementDrawer";
import { AnnouncementFormDrawer } from "@/app/(private)/dashboard/pengadaan-barang/_components/AnnouncementFormDrawer";
import { BudgetFormDrawer } from "@/app/(private)/dashboard/pengadaan-barang/_components/BudgetFormDrawer";
import { useDrawerController, type OpenDrawerOptions } from "@/hooks/use-drawer-controller";

interface ProcurementDrawerContextValue {
  openProcurementDrawer: (opts?: OpenDrawerOptions) => void;
  openAnnouncementDrawer: (opts?: OpenDrawerOptions) => void;
  openBudgetDrawer: (opts?: OpenDrawerOptions) => void;
}

const ProcurementDrawerContext =
  createContext<ProcurementDrawerContextValue | null>(null);

export function ProcurementDrawerProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const procurement = useDrawerController();
  const announcement = useDrawerController();
  const budget = useDrawerController();

  return (
    <ProcurementDrawerContext.Provider
      value={{
        openProcurementDrawer: procurement.openDrawer,
        openAnnouncementDrawer: announcement.openDrawer,
        openBudgetDrawer: budget.openDrawer,
      }}
    >
      {children}
      {procurement.open && (
        <AddProcurementDrawer
          open={procurement.open}
          onOpenChange={procurement.setOpen}
          onSuccess={procurement.handleSuccess}
        />
      )}
      {announcement.open && (
        <AnnouncementFormDrawer
          open={announcement.open}
          onOpenChange={announcement.setOpen}
          onSuccess={announcement.handleSuccess}
        />
      )}
      {budget.open && (
        <BudgetFormDrawer
          open={budget.open}
          onOpenChange={budget.setOpen}
          onSuccess={budget.handleSuccess}
        />
      )}
    </ProcurementDrawerContext.Provider>
  );
}

export function useProcurementDrawer(): ProcurementDrawerContextValue {
  const ctx = useContext(ProcurementDrawerContext);
  if (!ctx)
    throw new Error(
      "useProcurementDrawer must be used within ProcurementDrawerProvider"
    );
  return ctx;
}
