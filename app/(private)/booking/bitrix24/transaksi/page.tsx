import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { BitrixDealsManager } from "./_components/bitrix-deals-manager";

export const metadata: Metadata = {
  title: "Transaksi Bitrix24 - SWASANA",
  description: "Data transaksi (deals) CRM dari Bitrix24",
};

export default async function BitrixTransaksiPage() {
  await requirePagePermission("customers");
  return <BitrixDealsManager />;
}
