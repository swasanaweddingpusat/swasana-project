import type { Metadata } from "next";
import { VendorsTable } from "./_components/vendors-table";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Vendors - SWASANA",
  description: "Kelola vendor dan supplier",
};

export default async function VendorsPage() {
  await requirePagePermission("vendor");
  return (
    <div className="flex flex-col mb-6 px-2">
      <VendorsTable />
    </div>
  );
}
