import type { Metadata } from "next";
import { Suspense } from "react";
import { MicePackagesTable } from "./_components/mice-packages-table";
import { requirePagePermission } from "@/lib/require-page-permission";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mice Package - SWASANA",
  description: "Kelola paket MICE per venue",
};

export default async function MicePackagePage() {
  await requirePagePermission("package-mice");
  return (
    <div className={cn("flex", "flex-col", "mb-6", "px-2")}>
      <Suspense fallback={null}>
        <MicePackagesTable />
      </Suspense>
    </div>
  );
}
