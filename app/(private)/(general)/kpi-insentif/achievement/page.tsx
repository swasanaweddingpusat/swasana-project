import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getAchievementSchemas } from "@/lib/queries/kpiInsentif";
import { AchievementClient } from "./_components/AchievementClient";

export const metadata: Metadata = { title: "Skema Achievement" };

export default async function Page() {
  await requirePagePermission("kpi-master");
  const schemas = await getAchievementSchemas();
  return <AchievementClient initialSchemas={schemas} />;
}
