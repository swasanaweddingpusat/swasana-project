import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import {
  getTargetItems,
  getAchievementSchemas,
  getKpiMasters,
  getCommissionPolicies,
} from "@/lib/queries/kpiInsentif";
import { KonfigurasiClient } from "./_components/KonfigurasiClient";

export const metadata: Metadata = { title: "Konfigurasi KPI" };

export default async function KonfigurasiPage() {
  await requirePagePermission("kpi-master");

  const [items, schemas, masters, policies] = await Promise.all([
    getTargetItems(),
    getAchievementSchemas(),
    getKpiMasters({}),
    getCommissionPolicies(),
  ]);

  return (
    <KonfigurasiClient
      initialItems={items}
      initialSchemas={schemas}
      initialMasters={masters}
      initialPolicies={policies}
    />
  );
}
