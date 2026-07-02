import type { Metadata } from "next";
import { getBookings, getSalesProfiles } from "@/lib/queries/bookings";
import { BookingsTableClient } from "./_components/bookings-table-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";
import { requirePagePermission } from "@/lib/require-page-permission";

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

  // Default to the current year so the SSR initialData matches the client's default
  // year filter (bookings-table defaults to currentYear). Without this the first
  // paint would fetch ALL years while the dropdown says "current year" — a mismatch,
  // and it would also defeat the scalability guard on the very first load.
  const [bookings, salesProfiles] = await Promise.all([getBookings(profileId, dataScope, { category: "WEDDINGS", year: new Date().getFullYear() }), getSalesProfiles()]);
  return (
    <div className="flex flex-col gap-4">
      <BookingsTableClient initialData={bookings} salesProfiles={salesProfiles} />
    </div>
  );
}
