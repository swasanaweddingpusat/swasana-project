import { Suspense } from "react";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { requirePagePermission } from "@/lib/require-page-permission";
import { db } from "@/lib/db";
import { AnnouncementTab } from "../_components/AnnouncementTab";

export const metadata: Metadata = {
  title: "Pengumuman Pengadaan",
  description: "Kelola pengumuman pengadaan barang",
};

async function CachedContent() {
  "use cache";
  cacheLife("max");
  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <AnnouncementTab venues={venues} />;
}

export default async function PengumumanPage() {
  await requirePagePermission("procurement");

  return (
    <div className="flex flex-col mb-6 px-2">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <CachedContent />
      </Suspense>
    </div>
  );
}
