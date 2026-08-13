import { Suspense } from "react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { requirePagePermission } from "@/lib/require-page-permission";
import { db } from "@/lib/db";
import { ProcurementClient } from "./_components/ProcurementClient";

export const metadata: Metadata = {
  title: "Pengadaan Barang",
  description: "Kelola pengadaan dan pembelian barang",
};

async function CachedVenues() {
  "use cache";
  cacheLife("max");

  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <ProcurementClient initialVenues={venues} />;
}

function ProcurementLoading() {
  return (
    <div className="flex flex-col gap-6 px-2 mb-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default async function PengadaanBarangPage() {
  await requirePagePermission("procurement");

  return (
    <div className="flex flex-col mb-6 px-2">
      <Suspense fallback={<ProcurementLoading />}>
        <CachedVenues />
      </Suspense>
    </div>
  );
}
