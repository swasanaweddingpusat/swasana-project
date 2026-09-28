import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getProspectStatuses() {
  "use cache";
  cacheTag("prospect-statuses");
  cacheLife("minutes");

  return db.prospectStatus.findMany({
    select: { id: true, name: true, sortOrder: true, createdAt: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 500,
  });
}

export type ProspectStatusesResult = Awaited<ReturnType<typeof getProspectStatuses>>;
export type ProspectStatusItem = ProspectStatusesResult[number];
