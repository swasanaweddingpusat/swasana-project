import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveAvatarUrl } from "@/lib/storage";

export interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  names: string[];
}

const COMMENT_SELECT = {
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
  reactions: {
    select: {
      emoji: true,
      profileId: true,
      profile: { select: { fullName: true } },
    },
  },
} as const;

export async function getBookingComments(
  bookingId: string,
  profileId: string | undefined,
  options?: { highlightCommentId?: string; limit?: number },
) {
  const limit = options?.limit ?? 50;
  const where = { bookingId };

  // Take the latest `limit` comments. If highlightCommentId is given, ensure it
  // is always in the result — fetch it separately if it falls outside the window.
  const latest = await db.bookingComment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: COMMENT_SELECT,
  });

  let data = latest;
  if (options?.highlightCommentId && !latest.some((c) => c.id === options.highlightCommentId)) {
    const highlighted = await db.bookingComment.findUnique({
      where: { id: options.highlightCommentId },
      select: COMMENT_SELECT,
    });
    if (highlighted) {
      data = [highlighted, ...latest].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
  }

  const resolved = data.map((c) => {
    // Aggregate raw reactions into per-emoji summaries
    const reactionMap = new Map<string, { names: string[]; reactedByMe: boolean }>();
    for (const r of c.reactions) {
      const entry = reactionMap.get(r.emoji) ?? { names: [], reactedByMe: false };
      entry.names.push(r.profile.fullName ?? "");
      if (r.profileId === profileId) entry.reactedByMe = true;
      reactionMap.set(r.emoji, entry);
    }
    const reactions: AggregatedReaction[] = Array.from(reactionMap.entries()).map(
      ([emoji, { names, reactedByMe }]) => ({ emoji, count: names.length, reactedByMe, names })
    );

    return {
      ...c,
      reactions,
      author: { ...c.author, avatarUrl: resolveAvatarUrl(c.author.avatarUrl) },
    };
  });

  return resolved;
}

export type BookingCommentsResult = Awaited<ReturnType<typeof getBookingComments>>;
type RawBookingCommentItem = BookingCommentsResult[number];
export type BookingCommentItem = Omit<RawBookingCommentItem, "reactions"> & {
  reactions?: AggregatedReaction[];
};

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

  // NOTE: kolom Prisma camelCase TANPA @map → di Postgres tetap camelCase,
  // jadi WAJIB di-double-quote ("bookingId", bukan booking_id). Hanya nama
  // TABEL yang snake_case (via @@map).
  type Row = { bookingId: string; cnt: bigint };

  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT bc."bookingId", COUNT(*)::bigint AS cnt
    FROM booking_comments bc
    WHERE bc."bookingId" = ANY(${bookingIds}::text[])
      AND bc."authorId" <> ${profileId}
      AND bc."createdAt" > COALESCE(
        (
          SELECT bcr."lastReadAt"
          FROM booking_comment_reads bcr
          WHERE bcr."bookingId" = bc."bookingId"
            AND bcr."profileId" = ${profileId}
        ),
        '1970-01-01'::timestamptz
      )
    GROUP BY bc."bookingId"
  `);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.bookingId] = Number(row.cnt);
  }
  return result;
}
