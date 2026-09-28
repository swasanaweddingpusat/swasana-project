import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getTargetItems, getAchievementSchemas, getKpiMasters } from "@/lib/queries/kpiInsentif";
import { KonfigurasiClient } from "@/app/(private)/(general)/kpi-insentif/konfigurasi/_components/KonfigurasiClient";

export const metadata: Metadata = { title: "Konfigurasi KPI" };

export default async function KpiKonfigurasiSettingsPage() {
  await requirePagePermission("kpi-master");

  const [items, schemas, masters] = await Promise.all([
    getTargetItems(),
    getAchievementSchemas(),
    getKpiMasters({}),
  ]);

  return (
    <div className="px-6 pb-6">
      <KonfigurasiClient initialItems={items} initialSchemas={schemas} initialMasters={masters} />
    </div>
  );
}
