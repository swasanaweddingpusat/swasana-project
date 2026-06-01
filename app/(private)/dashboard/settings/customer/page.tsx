import type { Metadata } from "next";
import { connection } from "next/server";
import { getCustomers } from "@/lib/queries/customers";
import { CustomersTable } from "./_components/customers-table";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Customers",
  description: "Kelola data customer",
};

export default async function CustomersPage() {
  await requirePagePermission("customers");
  await connection();
  const customers = await getCustomers();
  return (
    <div className="flex flex-col mb-6 px-2">
      <CustomersTable initialData={customers} />
    </div>
  );
}
