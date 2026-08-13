import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AttendanceManagement } from "./_components/AttendanceManagement";

export const metadata: Metadata = {
  title: "Manajemen Kehadiran - SWASANA",
  description: "Rekap kehadiran karyawan",
};

export default async function ManajemenKehadiranPage() {
  await requirePagePermission("hr", "view-all");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <AttendanceManagement />
    </div>
  );
}
