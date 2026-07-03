import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePagePermission } from "@/lib/require-page-permission";
import { db } from "@/lib/db";
import { ProcurementClient } from "./_components/ProcurementClient";

export const metadata: Metadata = {
  title: "Pengadaan Barang",
  description: "Kelola pengadaan dan pembelian barang",
};

export default async function PengadaanBarangPage() {
  await connection();
  await requirePagePermission("procurement");

  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col mb-6 px-2">
      <ProcurementClient initialVenues={venues} />
    </div>
  );
}
