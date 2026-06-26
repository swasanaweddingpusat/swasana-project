import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PayrollManagement } from "./_components/PayrollManagement";

export const metadata: Metadata = {
  title: "Penggajian & Perpajakan - SWASANA",
  description: "Kelola payroll dan perpajakan karyawan",
};

export default async function PenggajianPerpajakanPage() {
  await requirePagePermission("hr-payroll");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <PayrollManagement />
    </div>
  );
}
