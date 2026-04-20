import { getBrands } from "@/lib/queries/venues";
import { BrandsManager } from "./_components/brands-manager";

export default async function BrandsSettingsPage() {
  const brands = await getBrands();
  return (
    <div className="px-6 py-4">
      <BrandsManager initialData={brands} />
    </div>
  );
}
