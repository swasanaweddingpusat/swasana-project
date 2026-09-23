import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { AttendanceClock } from "./_components/AttendanceClock";
import { AttendanceHistory } from "./_components/AttendanceHistory";

export const metadata: Metadata = {
  title: "Absensi - SWASANA",
  description: "Clock in dan clock out harian",
};

export default async function AbsensiPage() {
  await requirePagePermission("attendance");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <AttendanceClock />
      <AttendanceHistory />
    </div>
  );
}
