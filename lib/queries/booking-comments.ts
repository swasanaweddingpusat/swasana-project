import { db } from "@/lib/db";

export async function getBookingComments(bookingId: string, page = 1, limit = 10) {
  const where = { bookingId };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.bookingComment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
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
    }),
    db.bookingComment.count({ where }),
  ]);

  return { data, total, page, limit };
}

export type BookingCommentsResult = Awaited<ReturnType<typeof getBookingComments>>;
export type BookingCommentItem = BookingCommentsResult["data"][number];

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
