import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export async function getCalendarEvents(year: number, month: number, profileId?: string, dataScope?: DataScope) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const where = await buildScopeFilter(profileId, dataScope);

  return db.booking.findMany({
    where: {
      ...where,
      bookingDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      bookingDate: true,
      weddingSession: true,
      weddingType: true,
      bookingStatus: true,
      snapCustomer: { select: { name: true } },
      snapVenue: { select: { venueName: true } },
      snapPackage: { select: { packageName: true } },
    },
    orderBy: { bookingDate: "asc" },
  });
}

async function buildScopeFilter(profileId?: string, dataScope?: DataScope) {
  if (!profileId || !dataScope || dataScope === "all") return {};
  if (dataScope === "own") return { salesId: profileId };

  const subordinateAccess = await db.userVenueAccess.findMany({
    where: { managerId: profileId },
    select: { userId: true },
  });
  const subordinateIds = [...new Set(subordinateAccess.map((a) => a.userId))];
  if (subordinateIds.length === 0) return { salesId: profileId };

  return { salesId: { in: [...subordinateIds, profileId] } };
}

export type CalendarEventsResult = Awaited<ReturnType<typeof getCalendarEvents>>;
export type CalendarEventItem = CalendarEventsResult[number];
