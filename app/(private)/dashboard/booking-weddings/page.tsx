import type { Metadata } from "next";
import { getBookings, getSalesProfiles } from "@/lib/queries/bookings";
import { BookingsTableClient } from "./_components/bookings-table-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";
import { requirePagePermission } from "@/lib/require-page-permission";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Kelola data booking",
};

export default async function BookingsPage() {
  await requirePagePermission("booking");
  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;
  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const [bookings, salesProfiles] = await Promise.all([getBookings(profileId, dataScope), getSalesProfiles()]);
  return (
    <div className={cn('flex', 'flex-col', 'mb-6', 'px-2')}>
      <BookingsTableClient initialData={bookings} salesProfiles={salesProfiles} />
    </div>
  );
}
