import { Suspense } from "react";
import { getEducationLevels } from "@/lib/queries/education-level";
import { EducationLevelManager } from "./_components/education-level-manager";
import { EducationLevelLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function EducationLevelSettingsPage() {
  await requirePagePermission("settings");
  return (
    <Suspense fallback={<EducationLevelLoading />}>
      <EducationLevelContent />
    </Suspense>
  );
}

async function EducationLevelContent() {
  const data = await getEducationLevels();
  return <EducationLevelManager initialData={data} />;
}
