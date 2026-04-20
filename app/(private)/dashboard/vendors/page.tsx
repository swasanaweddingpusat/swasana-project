import type { Metadata } from "next";
import { VendorsTable } from "./_components/vendors-table";

export const metadata: Metadata = {
  title: "Vendors - SWASANA",
  description: "Kelola vendor dan supplier",
};

export default function VendorsPage() {
  return (
    <div className="flex flex-col my-6 px-2">
      <VendorsTable />
    </div>
  );
}
