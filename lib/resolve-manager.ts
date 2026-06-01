import { db } from "@/lib/db";

/**
 * Resolve manager ID for a booking.
 * Fallback chain: group leader (any group with a leader) → profile.managerId → null
 *
 * Uses a filter for non-null leaderId so that if the user belongs to multiple groups
 * and only some have a leader, the first group WITH a leader is used — not the first
 * group regardless of leader presence.
 */
export async function resolveManagerId(userId: string): Promise<string | null> {
  // 1. Check group leader — find any group the user belongs to that has a leader.
  const membership = await db.userGroupMember.findFirst({
    where: { userId, group: { leaderId: { not: null } } },
    select: { group: { select: { leaderId: true } } },
  });
  if (membership?.group.leaderId) return membership.group.leaderId;

  // 2. Fallback: direct manager on profile
  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  return profile?.managerId ?? null;
}
