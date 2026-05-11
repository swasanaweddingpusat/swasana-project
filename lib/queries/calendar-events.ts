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

  const myGroups = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return { salesId: profileId };
  const groupIds = myGroups.map((g) => g.groupId);
  const members = await db.userGroupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const memberIds = [...new Set(members.map((m) => m.userId))];
  return { salesId: { in: memberIds } };
}

export type CalendarEventsResult = Awaited<ReturnType<typeof getCalendarEvents>>;
export type CalendarEventItem = CalendarEventsResult[number];
