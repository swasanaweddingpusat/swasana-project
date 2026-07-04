import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getTutorialCategories } from "@/lib/queries/tutorials";
import { TutorialManager } from "./_components/tutorial-manager";

export const metadata: Metadata = {
  title: "Tutorial CMS",
};

export default async function TutorialSettingsPage() {
  await connection();
  await requirePagePermission("settings-tutorial");
  const categories = await getTutorialCategories();

  return (
    <Suspense fallback={<p>Memuat konten tutorial...</p>}>
      <TutorialManager initialCategories={categories} />
    </Suspense>
  );
}
