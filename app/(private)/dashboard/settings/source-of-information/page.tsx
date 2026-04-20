import { getSourceOfInformations } from "@/lib/queries/source-of-information";
import { SourceOfInformationManager } from "./_components/source-of-information-manager";

export default async function SourceOfInformationSettingsPage() {
  const data = await getSourceOfInformations();
  return <SourceOfInformationManager initialData={data} />;
}
