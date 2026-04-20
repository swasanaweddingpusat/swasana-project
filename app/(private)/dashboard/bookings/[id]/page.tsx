import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingById } from "@/lib/queries/bookings";
import { BookingDetailView } from "./_components/booking-detail-view";

export const metadata: Metadata = {
  title: "Detail Booking",
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  return (
    <div className="flex flex-col my-6 px-2 gap-6">
      <BookingDetailView booking={booking} />
    </div>
  );
}
