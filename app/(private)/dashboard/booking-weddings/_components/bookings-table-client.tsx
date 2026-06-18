"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { BookingsResult, SalesProfile } from "@/lib/queries/bookings";
import { usePoll } from "@/hooks/use-poll";

const BookingsTable = dynamic(
  () => import("./bookings-table").then((m) => ({ default: m.BookingsTable })),
  { ssr: false }
);

export function BookingsTableClient({
  initialData,
  salesProfiles,
}: {
  initialData: BookingsResult;
  salesProfiles: SalesProfile[];
}) {
  usePoll();
  return (
    <Suspense>
      <BookingsTable initialData={initialData} salesProfiles={salesProfiles} />
    </Suspense>
  );
}
