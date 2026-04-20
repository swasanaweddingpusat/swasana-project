import type { Metadata } from "next";
import { getCustomers } from "@/lib/queries/customers";
import { CustomersTable } from "./_components/customers-table";

export const metadata: Metadata = {
  title: "Customers",
  description: "Kelola data customer",
};

export default async function CustomersPage() {
  const customers = await getCustomers();
  return (
    <div className="flex flex-col my-6 px-2">
      <CustomersTable initialData={customers} />
    </div>
  );
}
