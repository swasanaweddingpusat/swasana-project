import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { KoreksiAbsenTabs } from "./_components/KoreksiAbsenTabs";

export const metadata: Metadata = {
  title: "Koreksi Absen - SWASANA",
  description: "Persetujuan koreksi absensi & tipe kerja WFH/WFA karyawan",
};

export default async function KoreksiAbsenPage() {
  await requirePagePermission("hr-attendance", "approve");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <KoreksiAbsenTabs />
    </div>
  );
}
