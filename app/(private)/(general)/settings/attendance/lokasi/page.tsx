import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { WorkLocationManager } from "@/app/(private)/hrd/manajemen-kehadiran/_components/WorkLocationManager";

export const metadata: Metadata = { title: "Lokasi Kerja - SWASANA" };

export default async function WorkLocationsPage() {
  await requirePagePermission("hr-attendance");
  return <WorkLocationManager />;
}
