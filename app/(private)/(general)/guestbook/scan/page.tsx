import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { GuestbookScanClient } from "./_components/GuestbookScanClient";

export const metadata: Metadata = {
  title: "Scan Kehadiran Expo",
  description: "Konfirmasi kehadiran tamu expo lewat scan QR code",
};

export default async function GuestbookScanPage() {
  await requirePagePermission("guestbook");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <GuestbookScanClient />
    </div>
  );
}
