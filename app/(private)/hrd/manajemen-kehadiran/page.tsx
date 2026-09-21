import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manajemen Kehadiran - SWASANA",
  description: "Rekap kehadiran karyawan",
};

export default async function ManajemenKehadiranPage() {
  redirect("/settings/attendance/rekap");
}
