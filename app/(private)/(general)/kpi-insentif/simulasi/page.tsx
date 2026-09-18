// FILE: app/(private)/(general)/kpi-insentif/simulasi/page.tsx

import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { SimulasiClient } from "./_components/SimulasiClient";

export const metadata: Metadata = { title: "Simulasi & Rekonsiliasi KPI" };

export default async function Page() {
  await requirePagePermission("kpi-simulation");
  return <SimulasiClient />;
}
