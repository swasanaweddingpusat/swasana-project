import type { Metadata } from "next";
import { Suspense } from "react";
import { PackagesTable } from "./_components/packages-table";
import { requirePagePermission } from "@/lib/require-page-permission";
import { cn } from "../../../../lib/utils";

export const metadata: Metadata = {
  title: "Packages - SWASANA",
  description: "Kelola paket wedding",
};

export default async function PackagesPage() {
  await requirePagePermission("package");
  return (
    <div className={cn('flex', 'flex-col', 'mb-6', 'px-2')}>
      <Suspense fallback={null}>
        <PackagesTable />
      </Suspense>
    </div>
  );
}
