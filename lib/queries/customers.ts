import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getCustomers(page = 1, limit = 10, search = "") {
  "use cache";
  cacheTag("customers");
  cacheLife("minutes");

  const skip = (page - 1) * limit;
  const where = search.trim()
    ? { name: { contains: search.trim(), mode: "insensitive" as const } }
    : undefined;

  const [data, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.customer.count({ where }),
  ]);

  return { data, total, page, limit };
}

export type CustomersResult = Awaited<ReturnType<typeof getCustomers>>;
export type CustomerItem = CustomersResult["data"][number];
