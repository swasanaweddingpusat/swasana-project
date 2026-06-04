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

  const myGroups = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return [profileId];

  const members = await db.userGroupMember.findMany({
    where: { groupId: { in: myGroups.map((g) => g.groupId) } },
    select: { userId: true },
  });
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

  const [latestBooking, latestComment, notifCount] = await Promise.all([
    db.booking.findFirst({
      where: bookingWhere,
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    db.bookingComment.findFirst({
      where: { booking: bookingWhere },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.notification.count({
      where: { userId: profileId, isRead: false },
    }),
  ]);

  return {
    bookingsUpdatedAt: latestBooking?.updatedAt?.toISOString() ?? null,
    latestCommentAt: latestComment?.createdAt?.toISOString() ?? null,
    notificationCount: notifCount,
  };
}
