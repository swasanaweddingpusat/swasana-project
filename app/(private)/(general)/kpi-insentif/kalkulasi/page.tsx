import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { KalkulasiClient } from "./_components/KalkulasiClient";

export const metadata: Metadata = { title: "Kalkulasi & Laporan KPI" };

export default async function KalkulasiPage() {
  await requirePagePermission(["kpi-simulation", "kpi-report"]);
  return <KalkulasiClient />;
}
