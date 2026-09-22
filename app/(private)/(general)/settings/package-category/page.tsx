import { Suspense } from "react";
import { getPackageTypeCategories } from "@/lib/queries/package-type-categories";
import { PackageTypeCategoryManager } from "./_components/package-type-category-manager";
import { PackageTypeCategoryManagerLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function PackageCategorySettingsPage() {
  await requirePagePermission("settings-package-category");
  return (
    <Suspense fallback={<PackageTypeCategoryManagerLoading />}>
      <PackageCategoryContent />
    </Suspense>
  );
}

async function PackageCategoryContent() {
  const data = await getPackageTypeCategories();
  return <PackageTypeCategoryManager initialData={data} />;
}
