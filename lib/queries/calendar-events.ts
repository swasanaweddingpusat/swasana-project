import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export async function getCalendarEvents(year: number, month: number, profileId?: string, dataScope?: DataScope) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const where = await buildScopeFilter(profileId, dataScope);

  return db.booking.findMany({
    where: {
      ...where,
      recordStatus: "saved",
      eventDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      eventDate: true,
      weddingSession: true,
      weddingType: true,
      bookingStatus: true,
      snapCustomer: { select: { name: true } },
      snapVenue: { select: { venueName: true } },
      snapPackage: { select: { packageName: true } },
    },
    orderBy: { eventDate: "asc" },
  });
}

async function buildScopeFilter(profileId?: string, dataScope?: DataScope) {
  if (!profileId || !dataScope || dataScope === "all") return {};
  if (dataScope === "own") return { salesId: profileId };

  // group: find all groups where profileId is a member
  const myGroups = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return { salesId: profileId };
  const groupIds = myGroups.map((g) => g.groupId);

  // Fetch all members + group leaders (defensive: covers legacy leaders who
  // weren't added as members before this fix was deployed)
  const [members, groupLeaders] = await Promise.all([
    db.userGroupMember.findMany({
      where: { groupId: { in: groupIds } },
      select: { userId: true },
    }),
    db.userGroup.findMany({
      where: { id: { in: groupIds }, leaderId: { not: null } },
      select: { leaderId: true },
    }),
  ]);

  const memberIds = new Set(members.map((m) => m.userId));
  for (const g of groupLeaders) {
    if (g.leaderId) memberIds.add(g.leaderId);
  }

  return { salesId: { in: [...memberIds] } };
}

export type CalendarEventsResult = Awaited<ReturnType<typeof getCalendarEvents>>;
export type CalendarEventItem = CalendarEventsResult[number];

// ─── Dashboard mini-calendar ────────────────────────────────────────────────
// All bookings (weddings & MICE) carry the event day on `eventDate` after normalisasi.
export async function getDashboardCalendarEvents(
  year: number,
  month: number,
  profileId?: string,
  dataScope?: DataScope,
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const scope = await buildScopeFilter(profileId, dataScope);

  const bookings = await db.booking.findMany({
    where: {
      ...scope,
      recordStatus: "saved",
      eventDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      category: true,
      eventDate: true,
      weddingSession: true,
      bookingStatus: true,
      snapCustomer: { select: { name: true } },
      snapVenue: { select: { venueName: true } },
    },
  });

  return bookings
    .filter((b) => b.eventDate !== null)
    .map((b) => ({
      id: b.id,
      category: b.category,
      displayDate: b.eventDate!, // saved bookings always have eventDate
      weddingSession: b.weddingSession,
      bookingStatus: b.bookingStatus,
      customerName: b.snapCustomer?.name ?? null,
      venueName: b.snapVenue?.venueName ?? null,
    }))
    .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
}

export type DashboardCalendarEventsResult = Awaited<
  ReturnType<typeof getDashboardCalendarEvents>
>;
export type DashboardCalendarEventItem = DashboardCalendarEventsResult[number];
