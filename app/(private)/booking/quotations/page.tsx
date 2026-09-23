import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { QuotationsTable } from "./_components/quotations-table";

export const metadata: Metadata = {
  title: "Quotations",
  description: "Kelola data penawaran harga",
};

export default async function QuotationsPage() {
  await requirePagePermission("quotations");

  return (
    <div className="flex flex-col gap-4">
      <QuotationsTable />
    </div>
  );
}
