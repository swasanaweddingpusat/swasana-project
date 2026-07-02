import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { EmployeesTable } from "./_components/EmployeesTable";

export const metadata: Metadata = {
  title: "Database Karyawan - SWASANA",
  description: "Kelola data karyawan perusahaan",
};

export default async function DatabaseKaryawanPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <EmployeesTable />
    </div>
  );
}
