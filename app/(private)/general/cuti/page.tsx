import type { Metadata } from "next";
import { LeaveManagement } from "@/app/(private)/hrd/sistem-cuti/_components/LeaveManagement";

export const metadata: Metadata = {
  title: "Cuti Saya - SWASANA",
  description: "Pengajuan dan saldo cuti",
};

export default function CutiPage() {
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <LeaveManagement mode="self-service" />
    </div>
  );
}
