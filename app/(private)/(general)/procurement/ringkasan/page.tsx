import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ProcurementSummaryTab } from "../_components/ProcurementSummaryTab";

export const metadata: Metadata = {
  title: "Ringkasan Pengadaan",
  description: "Ringkasan dan statistik pengadaan barang",
};

export default async function RingkasanPage() {
  await requirePagePermission("procurement-summary");

  return (
    <div className="flex flex-col mb-6 px-2">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <ProcurementSummaryTab />
      </Suspense>
    </div>
  );
}
