import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { GuestbookOverviewClient } from "./_components/GuestbookOverviewClient";

export const metadata: Metadata = {
  title: "Overview Guestbook",
  description: "Ringkasan kunjungan tamu, vendor, dan client ke kantor",
};

export default async function GuestbookOverviewPage() {
  await requirePagePermission("guestbook");
  return <GuestbookOverviewClient />;
}
