import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getOrderStatuses() {
  "use cache";
  cacheTag("order-statuses");
  cacheLife("minutes");

  return db.orderStatus.findMany({
    select: { id: true, name: true, sortOrder: true, createdAt: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type OrderStatusesResult = Awaited<ReturnType<typeof getOrderStatuses>>;
export type OrderStatusItem = OrderStatusesResult[number];
