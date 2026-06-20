import { Prisma } from "@prisma/client";
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

/** Returns unread comment counts per bookingId for a given profile.
 *  Uses a single GROUP BY query to avoid N+1 round-trips.
 *  lastReadAt varies per booking, so we use a correlated subquery inside
 *  the WHERE clause — one SQL query total instead of 1+N.
 */
export async function getUnreadCommentCounts(
  bookingIds: string[],
  profileId: string
): Promise<Record<string, number>> {
  if (!bookingIds.length) return {};

  type Row = { booking_id: string; cnt: bigint };

  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT bc.booking_id, COUNT(*)::bigint AS cnt
    FROM booking_comments bc
    WHERE bc.booking_id = ANY(${bookingIds}::text[])
      AND bc.author_id <> ${profileId}
      AND bc.created_at > COALESCE(
        (
          SELECT bcr.last_read_at
          FROM booking_comment_reads bcr
          WHERE bcr.booking_id = bc.booking_id
            AND bcr.profile_id = ${profileId}
        ),
        '1970-01-01'::timestamptz
      )
    GROUP BY bc.booking_id
  `);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.booking_id] = Number(row.cnt);
  }
  return result;
}
