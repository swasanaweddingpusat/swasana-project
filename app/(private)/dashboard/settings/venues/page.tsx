import { Suspense } from "react";
import { getVenues, getBrands } from "@/lib/queries/venues";
import { VenuesTable } from "./_components/venues-table";
import { VenuesLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function VenuesSettingsPage() {
  await requirePagePermission("venue_management");
  return (
    <div className="px-6 pb-4">
      <Suspense fallback={<VenuesLoading />}>
        <VenuesContent />
      </Suspense>
    </div>
  );
}

async function VenuesContent() {
  const [venues, brands] = await Promise.all([getVenues(), getBrands()]);
  return <VenuesTable initialVenues={venues} brands={brands} />;
}
