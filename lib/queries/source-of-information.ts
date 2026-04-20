import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getSourceOfInformations() {
  "use cache";
  cacheTag("source-of-informations");
  cacheLife("minutes");

  return db.sourceOfInformation.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export type SourceOfInformationsResult = Awaited<ReturnType<typeof getSourceOfInformations>>;
export type SourceOfInformationItem = SourceOfInformationsResult[number];
