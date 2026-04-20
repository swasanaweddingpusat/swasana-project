import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getCustomers() {
  "use cache";
  cacheTag("customers");
  cacheLife("minutes");

  return db.customer.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type CustomersResult = Awaited<ReturnType<typeof getCustomers>>;
export type CustomerItem = CustomersResult[number];
