import { Suspense } from "react";
import { getPublicHolidays } from "@/lib/queries/publicHoliday";
import { PublicHolidayManager } from "./_components/public-holiday-manager";
import { PublicHolidayLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function PublicHolidaySettingsPage() {
  await requirePagePermission("settings-public-holiday");
  return (
    <Suspense fallback={<PublicHolidayLoading />}>
      <PublicHolidayContent />
    </Suspense>
  );
}

async function PublicHolidayContent() {
  const data = await getPublicHolidays();
  return <PublicHolidayManager initialData={data} />;
}
