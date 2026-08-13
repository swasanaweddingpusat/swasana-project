import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { MiceTable } from "./_components/mice-table";

export const metadata: Metadata = {
  title: "Booking MICE",
};

export default async function MicePage() {
  await requirePagePermission("booking-mice");

  return (
    <div className="flex flex-col gap-4">
      <MiceTable />
    </div>
  );
}
