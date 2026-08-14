import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { BitrixOverview } from "./_components/bitrix-overview";

export const metadata: Metadata = {
  title: "Overview Bitrix24 - SWASANA",
  description: "Ringkasan perolehan lead & database CRM dari Bitrix24",
};

export default async function BitrixOverviewPage() {
  await requirePagePermission("customers");
  return <BitrixOverview />;
}
