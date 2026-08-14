import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PayslipViewer } from "./_components/PayslipViewer";

export const metadata: Metadata = {
  title: "Slip Gaji - SWASANA",
  description: "Lihat slip gaji bulanan",
};

export default async function SlipGajiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <PayslipViewer />
    </div>
  );
}
