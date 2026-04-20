import { getVenues, getBrands } from "@/lib/queries/venues";
import { VenuesTable } from "./_components/venues-table";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function VenuesSettingsPage() {
  await requirePagePermission("venue_management");
  const [venues, brands] = await Promise.all([getVenues(), getBrands()]);
  return (
    <div className="px-6 pb-4">
      <VenuesTable initialVenues={venues} brands={brands} />
    </div>
  );
}
