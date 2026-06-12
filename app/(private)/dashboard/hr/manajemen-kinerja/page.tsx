import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = { title: "Manajemen Kinerja" };

export default async function ManajemenKinerjaPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">Manajemen Kinerja</p>
        <p className="mt-1 text-sm text-muted-foreground">Segera Hadir</p>
      </div>
    </div>
  );
}
