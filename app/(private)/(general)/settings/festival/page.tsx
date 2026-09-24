import { Suspense } from "react";
import { getFestivals } from "@/lib/queries/festivals";
import { FestivalManager } from "./_components/festival-manager";
import { FestivalLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function FestivalSettingsPage() {
  await requirePagePermission("settings-festival");
  return (
    <Suspense fallback={<FestivalLoading />}>
      <FestivalContent />
    </Suspense>
  );
}

async function FestivalContent() {
  const data = await getFestivals();
  return <FestivalManager initialData={data} />;
}
