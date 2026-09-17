import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";
import { requirePagePermission } from "@/lib/require-page-permission";
import {
  getDailyActivities,
  getDailyActivitySegmentOptions,
} from "@/lib/queries/daily-activity";
import { getSalesMiceProfiles } from "@/lib/queries/bookings";
import { getSourceOfInformations } from "@/lib/queries/source-of-information";
import { DailyActivityTableClient } from "./_components/daily-activity-table-client";

export const metadata: Metadata = {
  title: "Daily Activity",
  description: "Kelola aktivitas harian sales & prospek",
};

const DEFAULT_PAGE_SIZE = 10;

export default async function DailyActivityPage() {
  await requirePagePermission("daily-activity");
  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;

  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { dataScope: true },
    });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const caller = profileId ? { profileId, dataScope } : undefined;

  const [initialData, salesProfiles, segments, sources] = await Promise.all([
    getDailyActivities({ page: 1, pageSize: DEFAULT_PAGE_SIZE }, caller),
    getSalesMiceProfiles(),
    getDailyActivitySegmentOptions(),
    getSourceOfInformations(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <DailyActivityTableClient
        initialData={initialData}
        salesProfiles={salesProfiles}
        segments={segments}
        sources={sources}
      />
    </div>
  );
}
