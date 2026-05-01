import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getEventTypes() {
  "use cache";
  cacheTag("event-types");
  cacheLife("minutes");

  return db.eventType.findMany({
    select: { id: true, name: true, code: true, sortOrder: true, isActive: true, createdAt: true },
    orderBy: { sortOrder: "asc" },
  });
}

export type EventTypesResult = Awaited<ReturnType<typeof getEventTypes>>;
export type EventTypeItem = EventTypesResult[number];
