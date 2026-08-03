import { Suspense } from "react";
import { Metadata } from "next";
import { MaintenanceStatusManager } from "./_components/MaintenanceStatusManager";

export const metadata: Metadata = { title: "Maintenance Status" };

function MaintenanceStatusLoading() {
  return (
    <div className="p-6 space-y-3">
      <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function MaintenanceStatusPage() {
  return (
    <Suspense fallback={<MaintenanceStatusLoading />}>
      <MaintenanceStatusManager />
    </Suspense>
  );
}
