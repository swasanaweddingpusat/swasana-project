import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { EmployeeDetailTabs } from "../_components/EmployeeDetailTabs";

export const metadata: Metadata = {
  title: "Detail Karyawan - SWASANA",
  description: "Informasi lengkap karyawan",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("hr");
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <EmployeeDetailTabs employeeId={id} />
    </div>
  );
}
