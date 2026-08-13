import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { LeaveManagement } from "./_components/LeaveManagement";

export const metadata: Metadata = {
  title: "Sistem Cuti - SWASANA",
  description: "Kelola pengajuan dan saldo cuti",
};

export default async function SistemCutiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <LeaveManagement />
    </div>
  );
}
