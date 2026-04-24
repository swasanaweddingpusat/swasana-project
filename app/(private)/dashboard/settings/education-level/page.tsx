import { getEducationLevels } from "@/lib/queries/education-level";
import { EducationLevelManager } from "./_components/education-level-manager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function EducationLevelSettingsPage() {
  await requirePagePermission("settings");
  const data = await getEducationLevels();
  return <EducationLevelManager initialData={data} />;
}
