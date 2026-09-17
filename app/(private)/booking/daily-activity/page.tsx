import type { Metadata } from "next";
import { startOfMonth, endOfMonth } from "date-fns";
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

// Local calendar day (not UTC). Duplicated (not imported from a shared date
// util) to keep this server page self-contained — mirrors the same helper
// duplicated client-side in daily-activity-table.tsx so the initial render
// and the client's default filter agree.
function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Current calendar month — the default "Tanggal Aktivitas" filter window,
 * must mirror `getDefaultMonthRange()` in daily-activity-table.tsx. */
function getDefaultMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

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
  const defaultRange = getDefaultMonthRange();

  const [initialData, salesProfiles, segments, sources] = await Promise.all([
    getDailyActivities(
      {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        activityDateFrom: toIsoDay(defaultRange.from),
        activityDateTo: toIsoDay(defaultRange.to),
      },
      caller,
    ),
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
