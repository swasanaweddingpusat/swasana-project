import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { BitrixPercakapanManager } from "./_components/bitrix-percakapan-manager";

export const metadata: Metadata = {
  title: "Percakapan Bitrix24 - SWASANA",
  description: "Data percakapan Contact Center (Open Lines) dari Bitrix24",
};

export default async function BitrixPercakapanPage() {
  await requirePagePermission("bitrix");
  return <BitrixPercakapanManager />;
}
