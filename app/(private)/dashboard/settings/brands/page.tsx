import { Suspense } from "react";
import { getBrands } from "@/lib/queries/venues";
import { BrandsManager } from "./_components/brands-manager";
import { BrandsLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function BrandsSettingsPage() {
  await requirePagePermission("brand_management");
  return (
    <div className="px-6 pb-4">
      <Suspense fallback={<BrandsLoading />}>
        <BrandsContent />
      </Suspense>
    </div>
  );
}

async function BrandsContent() {
  const brands = await getBrands();
  return <BrandsManager initialData={brands} />;
}
