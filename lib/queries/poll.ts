import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

export interface PollData {
  bookingsUpdatedAt: string | null;
  latestCommentAt: string | null;
  notificationCount: number;
}

async function getScopedSalesIds(
  profileId: string,
  dataScope: DataScope,
): Promise<string[] | null> {
  if (dataScope === "all") return null;
  if (dataScope === "own") return [profileId];

  // Single round-trip: pull every member of any group the user belongs to,
  // via the relation filter — equivalent to the old two-query (my-groups →
  // members) flow, but without the sequential dependency.
  const members = await db.userGroupMember.findMany({
    where: { group: { members: { some: { userId: profileId } } } },
    select: { userId: true },
  });
  if (members.length === 0) return [profileId];
  return [...new Set(members.map((m) => m.userId))];
}

export async function getPollData(
  profileId: string,
  dataScope: DataScope,
): Promise<PollData> {
  const salesIds = await getScopedSalesIds(profileId, dataScope);
  const bookingWhere = salesIds
    ? { recordStatus: "saved" as const, salesId: { in: salesIds } }
    : { recordStatus: "saved" as const };

  // Run sequentially — Neon HTTP has a limited connection pool; parallel queries
  // during a heavy concurrent write (e.g. editBooking) trigger P1017 ConnectionClosed.
  const latestBooking = await db.booking.findFirst({
    where: bookingWhere,
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  const latestComment = await db.bookingComment.findFirst({
    where: { booking: bookingWhere },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const notifCount = await db.notification.count({
    where: { userId: profileId, isRead: false },
  });

  return {
    bookingsUpdatedAt: latestBooking?.updatedAt?.toISOString() ?? null,
    latestCommentAt: latestComment?.createdAt?.toISOString() ?? null,
    notificationCount: notifCount,
  };
}
