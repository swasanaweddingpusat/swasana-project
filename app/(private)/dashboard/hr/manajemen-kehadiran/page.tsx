import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AttendanceFilter } from "./_components/AttendanceFilter";
import { AttendanceTable } from "./_components/AttendanceTable";
import { AttendanceSettingsPanel } from "./_components/AttendanceSettingsPanel";

export const metadata: Metadata = {
  title: "Manajemen Kehadiran - SWASANA",
  description: "Rekap kehadiran karyawan",
};

export default async function ManajemenKehadiranPage() {
  await requirePagePermission("hr", "view-all");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <AttendanceFilter />
      <AttendanceTable />
      <AttendanceSettingsPanel />
    </div>
  );
}
