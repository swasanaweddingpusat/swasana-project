import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AttendanceFilter } from "@/app/(private)/hrd/manajemen-kehadiran/_components/AttendanceFilter";
import { AttendanceTable } from "@/app/(private)/hrd/manajemen-kehadiran/_components/AttendanceTable";

export const metadata: Metadata = { title: "Rekap Kehadiran - SWASANA" };

export default async function AttendanceRecapPage() {
  await requirePagePermission("hr-attendance");
  return <div className="space-y-6"><AttendanceFilter /><AttendanceTable /></div>;
}
