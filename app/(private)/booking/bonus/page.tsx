import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { BonusManager } from "./_components/bonus-manager";

export const metadata: Metadata = {
  title: "Bonus - SWASANA",
  description: "Kelola master item bonus untuk booking",
};

export default async function BonusPage() {
  await requirePagePermission("bonus");
  return <BonusManager />;
}
