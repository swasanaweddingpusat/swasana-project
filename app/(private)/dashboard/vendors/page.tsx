import type { Metadata } from "next";
import { VendorsTable } from "./_components/vendors-table";
import { requirePagePermission } from "@/lib/require-page-permission";
import { cn } from "../../../../lib/utils";

export const metadata: Metadata = {
  title: "Vendors - SWASANA",
  description: "Kelola vendor dan supplier",
};

export default async function VendorsPage() {
  await requirePagePermission("vendor");
  return (
    <div className={cn('flex', 'flex-col', 'mb-6', 'w-full')}>
      <VendorsTable />
    </div>
  );
}
