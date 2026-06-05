import type { Metadata } from "next";
import { MiceTable } from "./_components/mice-table";

export const metadata: Metadata = {
  title: "Booking MICE",
};

export default function MicePage() {
  return (
    <div className="flex flex-col gap-4">
      <MiceTable />
    </div>
  );
}
