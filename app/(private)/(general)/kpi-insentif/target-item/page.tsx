import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getTargetItems } from "@/lib/queries/kpiInsentif";
import { TargetItemClient } from "./_components/TargetItemClient";

export const metadata: Metadata = { title: "Master Target Item" };

export default async function Page() {
  await requirePagePermission("kpi-master");
  const items = await getTargetItems();
  return <TargetItemClient initialItems={items} />;
}
