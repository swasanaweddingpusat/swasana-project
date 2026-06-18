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
// Weddings carry the event on `bookingDate`; MICE carry it on `eventDate`.
// We fetch any booking whose bookingDate OR eventDate falls in the month, then
// compute a single `displayDate` so the widget can group both categories by the
// real event day.
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
      OR: [
        { bookingDate: { gte: start, lt: end } },
        { eventDate: { gte: start, lt: end } },
      ],
    },
    select: {
      id: true,
      category: true,
      bookingDate: true,
      eventDate: true,
      weddingSession: true,
      bookingStatus: true,
      snapCustomer: { select: { name: true } },
      snapVenue: { select: { venueName: true } },
    },
  });

  return bookings
    .map((b) => {
      // MICE shows on its event day; fall back to bookingDate when eventDate is null.
      const displayDate =
        b.category === "MICE" ? (b.eventDate ?? b.bookingDate) : b.bookingDate;
      return {
        id: b.id,
        category: b.category,
        displayDate,
        weddingSession: b.weddingSession,
        bookingStatus: b.bookingStatus,
        customerName: b.snapCustomer?.name ?? null,
        venueName: b.snapVenue?.venueName ?? null,
      };
    })
    // After remapping to displayDate, drop anything that landed outside the month
    // (e.g. a MICE row matched on bookingDate but whose eventDate is next month).
    .filter((e) => e.displayDate >= start && e.displayDate < end)
    .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
}

export type DashboardCalendarEventsResult = Awaited<
  ReturnType<typeof getDashboardCalendarEvents>
>;
export type DashboardCalendarEventItem = DashboardCalendarEventsResult[number];
