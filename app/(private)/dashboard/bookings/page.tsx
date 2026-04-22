import type { Metadata } from "next";
import { getBookings, getSalesProfiles } from "@/lib/queries/bookings";
import { BookingsTable } from "./_components/bookings-table";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Kelola data booking",
};

export default async function BookingsPage() {
  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;
  let dataScope: DataScope = "own";
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { dataScope: true } });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const [bookings, salesProfiles] = await Promise.all([getBookings(profileId, dataScope), getSalesProfiles()]);
  return (
    <div className="flex flex-col mb-6 px-2">
      <BookingsTable initialData={bookings} salesProfiles={salesProfiles} />
    </div>
  );
}
