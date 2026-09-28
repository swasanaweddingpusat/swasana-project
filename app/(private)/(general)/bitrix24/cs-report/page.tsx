import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { CsReportClient } from "./_components/cs-report-client";

export const metadata: Metadata = {
  title: "Report Chat CS - SWASANA",
  description: "Ringkasan chat masuk harian CS & auto-generate report WhatsApp dari Bitrix24",
};

export default async function CsReportPage() {
  await requirePagePermission("bitrix");
  return <CsReportClient />;
}
