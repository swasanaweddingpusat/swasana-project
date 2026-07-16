import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ManajemenKinerjaClient } from "./_components/ManajemenKinerjaClient";

export const metadata: Metadata = { title: "Manajemen Kinerja" };

export default async function ManajemenKinerjaPage() {
  await requirePagePermission("hr");
  return <ManajemenKinerjaClient />;
}
