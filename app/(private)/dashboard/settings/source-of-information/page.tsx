import { getSourceOfInformations } from "@/lib/queries/source-of-information";
import { SourceOfInformationManager } from "./_components/source-of-information-manager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function SourceOfInformationSettingsPage() {
  await requirePagePermission("source_of_information");
  const data = await getSourceOfInformations();
  return <SourceOfInformationManager initialData={data} />;
}
