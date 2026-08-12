import type { Metadata } from "next";
import { PayslipViewer } from "@/app/(private)/dashboard/hr/slip-gaji/_components/PayslipViewer";

export const metadata: Metadata = {
  title: "Slip Gaji Saya - SWASANA",
  description: "Lihat slip gaji bulanan saya",
};

export default function SlipGajiSayaPage() {
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <PayslipViewer />
    </div>
  );
}
