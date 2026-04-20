import type { Metadata } from "next";
import { Suspense } from "react";
import { PackagesTable } from "./_components/packages-table";

export const metadata: Metadata = {
  title: "Packages - SWASANA",
  description: "Kelola paket wedding",
};

export default function PackagesPage() {
  return (
    <div className="flex flex-col my-6 px-2">
      <Suspense fallback={null}>
        <PackagesTable />
      </Suspense>
    </div>
  );
}
