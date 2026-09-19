// FILE: app/(private)/(general)/kpi-insentif/laporan/page.tsx

import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { LaporanClient } from "./_components/LaporanClient";

export const metadata: Metadata = { title: "Laporan KPI & Insentif" };

export default async function Page() {
  await requirePagePermission("kpi-report");
  return <LaporanClient />;
}
