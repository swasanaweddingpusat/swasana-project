import type { Metadata } from "next";
import { getBookings } from "@/lib/queries/bookings";
import { BookingsTable } from "./_components/bookings-table";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Kelola data booking",
};

export default async function BookingsPage() {
  const bookings = await getBookings();
  return (
    <div className="flex flex-col my-6 px-2">
      <BookingsTable initialData={bookings} />
    </div>
  );
}
