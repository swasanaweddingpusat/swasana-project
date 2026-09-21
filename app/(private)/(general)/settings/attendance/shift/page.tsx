import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { WorkShiftManager } from "@/app/(private)/hrd/manajemen-kehadiran/_components/WorkShiftManager";

export const metadata: Metadata = { title: "Shift Kerja - SWASANA" };

export default async function WorkShiftsPage() {
  await requirePagePermission("hr-attendance");
  return <WorkShiftManager />;
}
