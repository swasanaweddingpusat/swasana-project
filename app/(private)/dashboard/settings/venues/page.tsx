import { getVenues, getBrands } from "@/lib/queries/venues";
import { VenuesTable } from "./_components/venues-table";

export default async function VenuesSettingsPage() {
  const [venues, brands] = await Promise.all([getVenues(), getBrands()]);
  return (
    <div className="px-6 py-4">
      <VenuesTable initialVenues={venues} brands={brands} />
    </div>
  );
}
