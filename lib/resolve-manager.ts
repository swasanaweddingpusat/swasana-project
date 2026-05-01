import { db } from "@/lib/db";

/**
 * Resolve manager ID for a booking.
 * Fallback chain: group leader → venue access manager → null
 */
export async function resolveManagerId(userId: string, venueId: string): Promise<string | null> {
  // 1. Check group leader
  const membership = await db.userGroupMember.findFirst({
    where: { userId },
    select: { group: { select: { leaderId: true } } },
  });

  if (membership?.group.leaderId) return membership.group.leaderId;

  // 2. Check venue access manager
  const access = await db.userVenueAccess.findUnique({
    where: { userId_venueId: { userId, venueId } },
    select: { managerId: true },
  });

  return access?.managerId ?? null;
}
