import type { Metadata } from "next";
import { LeadsTable } from "./_components/leads-table";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-4">
      <LeadsTable />
    </div>
  );
}
