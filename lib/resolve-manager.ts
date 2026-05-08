import { db } from "@/lib/db";

/**
 * Resolve manager ID for a booking.
 * Fallback chain: group leader → profile.managerId → null
 */
export async function resolveManagerId(userId: string): Promise<string | null> {
  // 1. Check group leader
  const membership = await db.userGroupMember.findFirst({
    where: { userId },
    select: { group: { select: { leaderId: true } } },
  });
  if (membership?.group.leaderId) return membership.group.leaderId;

  // 2. Check direct manager on profile
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  return profile?.managerId ?? null;
}
