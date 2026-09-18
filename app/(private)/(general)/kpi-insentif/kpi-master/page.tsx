import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getKpiMasters } from "@/lib/queries/kpiInsentif";
import { KpiMasterClient } from "./_components/KpiMasterClient";

export const metadata: Metadata = { title: "Master KPI" };

export default async function Page() {
  await requirePagePermission("kpi-master");
  const masters = await getKpiMasters({});
  return <KpiMasterClient initialMasters={masters} />;
}
