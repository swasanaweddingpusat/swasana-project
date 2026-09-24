import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getFestivals() {
  "use cache";
  cacheTag("festivals");
  cacheLife("minutes");

  return db.festival.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      backgroundImageKey: true,
      startDate: true,
      endDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type FestivalsResult = Awaited<ReturnType<typeof getFestivals>>;
export type FestivalItem = FestivalsResult[number];
