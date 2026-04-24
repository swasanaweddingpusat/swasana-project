import { db } from "@/lib/db";

export async function getBookingComments(bookingId: string) {
  return db.bookingComment.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      mentions: true,
      edited: true,
      attachments: true,
      createdAt: true,
      author: { select: { id: true, fullName: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          author: { select: { fullName: true } },
        },
      },
    },
  });
}

export type BookingCommentsResult = Awaited<ReturnType<typeof getBookingComments>>;
export type BookingCommentItem = BookingCommentsResult[number];

/** Returns unread comment counts per bookingId for a given profile */
export async function getUnreadCommentCounts(
  bookingIds: string[],
  profileId: string
): Promise<Record<string, number>> {
  if (!bookingIds.length) return {};

  const reads = await db.bookingCommentRead.findMany({
    where: { profileId, bookingId: { in: bookingIds } },
    select: { bookingId: true, lastReadAt: true },
  });

  const readMap = new Map(reads.map((r: { bookingId: string; lastReadAt: Date }) => [r.bookingId, r.lastReadAt]));

  const counts = await Promise.all(
    bookingIds.map(async (bookingId) => {
      const lastReadAt = readMap.get(bookingId) ?? new Date(0);
      const count = await db.bookingComment.count({
        where: {
          bookingId,
          authorId: { not: profileId },
          createdAt: { gt: lastReadAt },
        },
      });
      return [bookingId, count] as const;
    })
  );

  return Object.fromEntries(counts.filter(([, count]) => count > 0));
}
