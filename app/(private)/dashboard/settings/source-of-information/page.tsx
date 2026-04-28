import { Suspense } from "react";
import { getSourceOfInformations } from "@/lib/queries/source-of-information";
import { SourceOfInformationManager } from "./_components/source-of-information-manager";
import { SourceOfInformationLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function SourceOfInformationSettingsPage() {
  await requirePagePermission("source_of_information");
  return (
    <Suspense fallback={<SourceOfInformationLoading />}>
      <SourceOfInformationContent />
    </Suspense>
  );
}

async function SourceOfInformationContent() {
  const data = await getSourceOfInformations();
  return <SourceOfInformationManager initialData={data} />;
}
