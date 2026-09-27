import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getKpiAwards } from "@/lib/queries/kpiInsentif";
import { AwardsClient } from "./_components/AwardsClient";

export const metadata: Metadata = { title: "Awards & Best Performer" };

export default async function Page() {
  await requirePagePermission("kpi-award");
  const awards = await getKpiAwards();
  return <AwardsClient initialAwards={awards} />;
}
