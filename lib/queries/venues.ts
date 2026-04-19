import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getVenues() {
  "use cache";
  cacheTag("venues");
  cacheLife("hours");

  return db.venue.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export type VenuesQueryResult = Awaited<ReturnType<typeof getVenues>>;
export type VenueQueryItem = VenuesQueryResult[number];
