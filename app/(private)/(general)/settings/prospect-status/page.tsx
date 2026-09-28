import { Suspense } from "react";
import { connection } from "next/server";
import { getProspectStatuses } from "@/lib/queries/prospect-status";
import { ProspectStatusManager } from "./_components/prospect-status-manager";
import { ProspectStatusLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default function ProspectStatusSettingsPage() {
  return (
    <Suspense fallback={<ProspectStatusLoading />}>
      <ProspectStatusContent />
    </Suspense>
  );
}

async function ProspectStatusContent() {
  await requirePagePermission("settings-prospect-status");
  await connection();
  const data = await getProspectStatuses();
  return <ProspectStatusManager initialData={data} />;
}
