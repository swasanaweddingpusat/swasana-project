import { Suspense } from "react";
import type { Metadata } from "next";
import { getComplimentaries } from "@/lib/queries/complimentary";
import { ComplimentaryManager } from "./_components/complimentary-manager";
import { ComplimentaryLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Complimentary - SWASANA",
  description: "Kelola master item complimentary untuk booking",
};

export default async function ComplimentaryPage() {
  await requirePagePermission("complimentary");
  return (
    <Suspense fallback={<ComplimentaryLoading />}>
      <ComplimentaryContent />
    </Suspense>
  );
}

async function ComplimentaryContent() {
  const data = await getComplimentaries();
  return <ComplimentaryManager initialData={data} />;
}
