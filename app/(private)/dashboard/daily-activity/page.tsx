import type { Metadata } from "next";
import { DailyActivityTable } from "./_components/daily-activity-table";

export const metadata: Metadata = {
  title: "Daily Activity",
};

export default function DailyActivityPage() {
  return (
    <div className="flex flex-col gap-4">
      <DailyActivityTable />
    </div>
  );
}
