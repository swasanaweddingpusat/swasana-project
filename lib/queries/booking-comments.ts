import { db } from "@/lib/db";
import { resolveAvatarUrl } from "@/lib/storage";

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

  const resolved = data.map((c) => ({
    ...c,
    author: { ...c.author, avatarUrl: resolveAvatarUrl(c.author.avatarUrl) },
  }));

  return { data: resolved, total, page, limit };
}

export type BookingCommentsResult = Awaited<ReturnType<typeof getBookingComments>>;
export type BookingCommentItem = BookingCommentsResult["data"][number];

/**
 * Returns count of unread mention notifications per bookingId for a given profile.
 * "Mention" = Notification dengan type "comment_mention" + isMention = true + isRead = false,
 * entityId = bookingId, dan userId = profileId.
 */
export async function getUnreadMentionCounts(
  bookingIds: string[],
  profileId: string
): Promise<Record<string, number>> {
  if (!bookingIds.length) return {};

  const mentions = await db.notification.findMany({
    where: {
      userId: profileId,
      isMention: true,
      isRead: false,
      entityType: "booking",
      entityId: { in: bookingIds },
    },
    select: { entityId: true },
  });

  const counts: Record<string, number> = {};
  for (const m of mentions) {
    if (!m.entityId) continue;
    counts[m.entityId] = (counts[m.entityId] ?? 0) + 1;
  }
  return counts;
}

export type MentionCountsResult = Record<string, number>;

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
