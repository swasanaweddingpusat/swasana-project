import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { CorrectionApprovalTable } from "./_components/CorrectionApprovalTable";

export const metadata: Metadata = { title: "Koreksi Absen - SWASANA" };

export default async function AttendanceCorrectionPage() {
  await requirePagePermission("attendance-correction");
  return (
    <div className="space-y-6">
      <CorrectionApprovalTable />
    </div>
  );
}
