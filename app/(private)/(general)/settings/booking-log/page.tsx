import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getBookingActivityLogs } from "@/lib/queries/booking-log";
import { BookingLogTable } from "./_components/booking-log-table";

export const metadata: Metadata = {
  title: "Booking Activity Log",
  description: "Monitoring activity log booking Wedding & MICE",
};

const PAGE_SIZE = 20;

export default async function BookingLogPage() {
  await requirePagePermission("settings-booking-log");
  await connection();

  const initialData = await getBookingActivityLogs({ page: 1, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col mb-6 px-2">
      <BookingLogTable initialData={initialData} pageSize={PAGE_SIZE} />
    </div>
  );
}
