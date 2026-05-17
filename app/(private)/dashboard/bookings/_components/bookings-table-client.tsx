"use client";

import dynamic from "next/dynamic";
import type { BookingsResult, SalesProfile } from "@/lib/queries/bookings";

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
  return <BookingsTable initialData={initialData} salesProfiles={salesProfiles} />;
}
