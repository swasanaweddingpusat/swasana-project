// FILE: app/(private)/(general)/kpi-insentif/penugasan/page.tsx

import { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PenugasanClient } from "./_components/PenugasanClient";

export const metadata: Metadata = { title: "Penugasan Target KPI" };

export default async function Page() {
  await requirePagePermission("kpi-assignment");
  return <PenugasanClient />;
}
