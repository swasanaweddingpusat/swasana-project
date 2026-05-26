import type { Metadata } from "next";
import { QuotationsTable } from "./_components/quotations-table";

export const metadata: Metadata = {
  title: "Quotations",
  description: "Kelola data penawaran harga",
};

export default function QuotationsPage() {
  return (
    <div className="flex flex-col mb-6 px-2">
      <QuotationsTable />
    </div>
  );
}
