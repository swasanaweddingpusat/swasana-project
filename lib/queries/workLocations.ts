import { db } from "@/lib/db";

export async function getWorkLocations() {
  return db.workLocation.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, address: true, venueId: true,
      latitude: true, longitude: true, radiusMeters: true,
      isActive: true, sortOrder: true,
      venue: { select: { id: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
}

export type WorkLocationItem = Awaited<ReturnType<typeof getWorkLocations>>[number];
