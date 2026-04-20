import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getVenues() {
  "use cache";
  cacheTag("venues");
  cacheLife("hours");

  return db.venue.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      brand: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export async function getBrands() {
  "use cache";
  cacheTag("brands");
  cacheLife("hours");

  return db.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      venues: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      },
    },
  });
}

export type VenuesQueryResult = Awaited<ReturnType<typeof getVenues>>;
export type VenueQueryItem = VenuesQueryResult[number];
export type BrandsQueryResult = Awaited<ReturnType<typeof getBrands>>;
export type BrandQueryItem = BrandsQueryResult[number];
