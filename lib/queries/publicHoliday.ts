import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPublicHolidays() {
  "use cache";
  cacheTag("public-holidays");
  cacheLife("minutes");

  return db.publicHoliday.findMany({
    select: { id: true, date: true, name: true, isActive: true, createdAt: true },
    orderBy: { date: "asc" },
    take: 500,
  });
}

export type PublicHolidaysResult = Awaited<ReturnType<typeof getPublicHolidays>>;
export type PublicHolidayItem = PublicHolidaysResult[number];
