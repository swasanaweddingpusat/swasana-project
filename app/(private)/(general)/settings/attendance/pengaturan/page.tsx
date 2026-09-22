import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AttendanceSettingsPanel } from "@/app/(private)/hrd/manajemen-kehadiran/_components/AttendanceSettingsPanel";
import { GlobalSettingsPanel } from "@/app/(private)/hrd/manajemen-kehadiran/_components/GlobalSettingsPanel";

export const metadata: Metadata = { title: "Pengaturan Kehadiran - SWASANA" };

export default async function AttendanceSettingsPage() {
  await requirePagePermission("hr-attendance");
  return <div className="space-y-4"><AttendanceSettingsPanel /><GlobalSettingsPanel /></div>;
}
