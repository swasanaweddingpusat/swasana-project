import type { Metadata } from "next";
import { getBookings, getSalesProfiles } from "@/lib/queries/bookings";
import { BookingsTable } from "./_components/bookings-table";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Kelola data booking",
};

export default async function BookingsPage() {
  const [bookings, salesProfiles] = await Promise.all([getBookings(), getSalesProfiles()]);
  return (
    <div className="flex flex-col mb-6 px-2">
      <BookingsTable initialData={bookings} salesProfiles={salesProfiles} />
    </div>
  );
}
