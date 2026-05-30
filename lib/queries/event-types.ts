import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getEventTypes(category?: "WEDDINGS" | "MICE") {
  "use cache";
  cacheTag("event-types");
  cacheLife("minutes");

  return db.eventType.findMany({
    where: {
      ...(category && { category }),
      isActive: true,
    },
    select: { id: true, name: true, code: true, category: true, sortOrder: true, isActive: true, createdAt: true },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export type EventTypesResult = Awaited<ReturnType<typeof getEventTypes>>;
export type EventTypeItem = EventTypesResult[number];
