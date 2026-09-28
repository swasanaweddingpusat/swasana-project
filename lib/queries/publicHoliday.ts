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

/**
 * Holiday-token balance for a profile. A "token" is not a ledger row — it's an
 * active PublicHoliday the profile has not yet referenced via an active
 * (pending/manager_approved/approved) holiday-token LeaveRequest. Not cached
 * with "use cache" (unlike getPublicHolidays) since it must reflect the
 * profile's in-flight submissions/cancellations immediately.
 */
export async function getAvailableHolidayTokens(profileId: string) {
  const activeHolidays = await db.publicHoliday.findMany({
    where: { isActive: true },
    select: { id: true, name: true, date: true },
    orderBy: { date: "asc" },
    take: 500,
  });

  if (activeHolidays.length === 0) return [];

  const usedRequests = await db.leaveRequest.findMany({
    where: {
      profileId,
      publicHolidayId: { in: activeHolidays.map((h) => h.id) },
      status: { in: ["pending", "manager_approved", "approved"] },
    },
    select: { publicHolidayId: true },
  });
  const usedHolidayIds = new Set(usedRequests.map((r) => r.publicHolidayId));

  return activeHolidays.filter((h) => !usedHolidayIds.has(h.id));
}

export type AvailableHolidayTokensResult = Awaited<ReturnType<typeof getAvailableHolidayTokens>>;
export type AvailableHolidayTokenItem = AvailableHolidayTokensResult[number];
