import { Suspense } from "react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { requirePagePermission } from "@/lib/require-page-permission";
import { db } from "@/lib/db";
import { VenueBudgetTab } from "../_components/VenueBudgetTab";

export const metadata: Metadata = {
  title: "Anggaran Venue",
  description: "Kelola anggaran venue untuk pengadaan barang",
};

async function CachedContent() {
  "use cache";
  cacheLife("max");
  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <VenueBudgetTab venues={venues} />;
}

export default async function AnggaranVenuePage() {
  await requirePagePermission("procurement-budget");

  return (
    <div className="flex flex-col mb-6 px-2">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <CachedContent />
      </Suspense>
    </div>
  );
}
