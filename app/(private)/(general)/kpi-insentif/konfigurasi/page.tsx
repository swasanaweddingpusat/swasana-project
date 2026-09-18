import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getTargetItems, getAchievementSchemas, getKpiMasters } from "@/lib/queries/kpiInsentif";
import { KonfigurasiClient } from "./_components/KonfigurasiClient";

export const metadata: Metadata = { title: "Konfigurasi KPI" };

export default async function KonfigurasiPage() {
  await requirePagePermission("kpi-master");

  const [items, schemas, masters] = await Promise.all([
    getTargetItems(),
    getAchievementSchemas(),
    getKpiMasters({}),
  ]);

  return <KonfigurasiClient initialItems={items} initialSchemas={schemas} initialMasters={masters} />;
}
