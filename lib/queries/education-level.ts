import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getEducationLevels() {
  "use cache";
  cacheTag("education-levels");
  cacheLife("minutes");

  return db.educationLevel.findMany({
    select: { id: true, name: true, order: true, createdAt: true },
    orderBy: { order: "asc" },
  });
}

export type EducationLevelsResult = Awaited<ReturnType<typeof getEducationLevels>>;
export type EducationLevelItem = EducationLevelsResult[number];
