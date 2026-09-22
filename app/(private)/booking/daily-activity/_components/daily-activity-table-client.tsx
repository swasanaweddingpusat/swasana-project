"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type {
  DailyActivitiesResult,
  DailyActivitySegmentOption,
} from "@/lib/queries/daily-activity";
import type { SalesMiceProfile } from "@/lib/queries/bookings";
import type { SourceOfInformationItem } from "@/lib/queries/source-of-information";

const DailyActivityTable = dynamic(
  () => import("./daily-activity-table").then((m) => ({ default: m.DailyActivityTable })),
  { ssr: false },
);

export function DailyActivityTableClient({
  initialData,
  salesProfiles,
  segments,
  sources,
}: {
  initialData: DailyActivitiesResult;
  salesProfiles: SalesMiceProfile[];
  segments: DailyActivitySegmentOption[];
  sources: SourceOfInformationItem[];
}) {
  return (
    <Suspense>
      <DailyActivityTable
        initialData={initialData}
        salesProfiles={salesProfiles}
        segments={segments}
        sources={sources}
      />
    </Suspense>
  );
}
