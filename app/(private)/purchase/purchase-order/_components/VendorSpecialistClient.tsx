"use client";

import dynamic from "next/dynamic";
import type { BookingsResult } from "@/lib/queries/bookings";

const VendorSpecialistTable = dynamic(
  () =>
    import("./VendorSpecialistTable").then((m) => ({
      default: m.VendorSpecialistTable,
    })),
  { ssr: false },
);

export function VendorSpecialistClient({
  initialData,
}: {
  initialData: BookingsResult;
}) {
  return <VendorSpecialistTable initialData={initialData} />;
}
