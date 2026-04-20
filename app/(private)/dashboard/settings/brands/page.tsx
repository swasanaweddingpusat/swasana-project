import { getBrands } from "@/lib/queries/venues";
import { BrandsManager } from "./_components/brands-manager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function BrandsSettingsPage() {
  await requirePagePermission("brand_management");
  const brands = await getBrands();
  return (
    <div className="px-6 pb-4">
      <BrandsManager initialData={brands} />
    </div>
  );
}
