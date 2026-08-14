import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ResponseSalesManager } from "./_components/response-sales-manager";

export const metadata: Metadata = {
  title: "Response Sales Bitrix24 - SWASANA",
  description: "Rata-rata waktu respons sales per percakapan Open Lines Bitrix24",
};

export default async function ResponseSalesPage() {
  await requirePagePermission("bitrix");
  return <ResponseSalesManager />;
}
