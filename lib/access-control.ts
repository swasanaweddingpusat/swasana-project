import { db } from "@/lib/db";
import type { DataScope } from "@/types/user";

/**
 * Check if user can access (read/write) a specific booking based on dataScope.
 * - "all" → always allowed
 * - "own" → only bookings where salesId === profileId
 * - "group" → bookings where salesId is in subordinate list (UserVenueAccess.managerId = profileId)
 */
export async function canAccessBooking(
  profileId: string,
  dataScope: DataScope,
  bookingId: string
): Promise<boolean> {
  if (dataScope === "all") return true;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { salesId: true },
  });
  if (!booking) return false;

  if (dataScope === "own") {
    return booking.salesId === profileId;
  }

  // group scope — check if salesId is reachable via any group where profileId is leader OR member.
  // Mirrors canViewSalesBookings() in lib/permissions.ts — same semantics, same query shape.
  // NOTE (Fase 0 refactor, lib/access-control.ts resolveGroupOwnerIds): intentionally
  // NOT consolidated onto resolveGroupOwnerIds. This is group-first (UserGroup where
  // leaderId=profileId OR members contains profileId), while resolveGroupOwnerIds is
  // membership-first (UserGroupMember where userId=profileId). They can diverge for a
  // leader who was never added as a UserGroupMember row of their own group — that
  // leader IS discovered here but would be MISSED by resolveGroupOwnerIds, falling
  // back to own-only. Consolidating risks a Booking access regression, so left as-is.
  if (booking.salesId === profileId) return true;
  const myGroups = await db.userGroup.findMany({
    where: {
      OR: [
        { leaderId: profileId },
        { members: { some: { userId: profileId } } },
      ],
    },
    select: {
      leaderId: true,
      members: { select: { userId: true } },
    },
  });
  if (myGroups.length === 0) return false;
  // A booking "tanpa PIC" (salesId null) is owned by no sales, so it's not
  // reachable through any group scope — only "all" scope (handled earlier) sees it.
  if (!booking.salesId) return false;
  const reachableIds = new Set<string>();
  for (const g of myGroups) {
    if (g.leaderId) reachableIds.add(g.leaderId);
    for (const m of g.members) reachableIds.add(m.userId);
  }
  return reachableIds.has(booking.salesId);
}

// ─── Helpers: resolve bookingId from related entities ────────────────────────

export async function getBookingIdFromTerm(termId: string): Promise<string | null> {
  const term = await db.termOfPayment.findUnique({
    where: { id: termId },
    select: { bookingId: true },
  });
  return term?.bookingId ?? null;
}

export async function getBookingIdFromSnapVendorItem(snapVendorItemId: string): Promise<string | null> {
  const item = await db.snapVendorItem.findUnique({
    where: { id: snapVendorItemId },
    select: { bookingId: true },
  });
  return item?.bookingId ?? null;
}

export async function getBookingIdFromDocument(docId: string): Promise<string | null> {
  const doc = await db.bookingDocument.findUnique({
    where: { id: docId },
    select: { bookingId: true },
  });
  return doc?.bookingId ?? null;
}

export async function getBookingIdFromComment(commentId: string): Promise<string | null> {
  const comment = await db.bookingComment.findUnique({
    where: { id: commentId },
    select: { bookingId: true },
  });
  return comment?.bookingId ?? null;
}

export async function getBookingIdFromSettlement(settlementId: string): Promise<string | null> {
  const settlement = await db.bookingPaymentSettlement.findUnique({
    where: { id: settlementId },
    select: { bookingId: true },
  });
  return settlement?.bookingId ?? null;
}

export async function getBookingIdFromSnapBonus(bonusId: string): Promise<string | null> {
  const bonus = await db.snapBonus.findUnique({
    where: { id: bonusId },
    select: { bookingId: true },
  });
  return bonus?.bookingId ?? null;
}

export async function getBookingIdFromSnapComplimentary(snapId: string): Promise<string | null> {
  const snap = await db.snapComplimentary.findUnique({
    where: { id: snapId },
    select: { bookingId: true },
  });
  return snap?.bookingId ?? null;
}

// ─── Get user's dataScope from session profileId ─────────────────────────────

export async function getProfileDataScope(profileId: string): Promise<DataScope> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { dataScope: true },
  });
  return (profile?.dataScope ?? "own") as DataScope;
}

// ─── Generic owner-scope resolution (Fase 0 — shared by Booking, later Guestbook) ──

/**
 * Resolve every profile id sharing a group with `profileId` (members + leaders),
 * including `profileId` itself. Membership-first: discovers group membership via
 * `UserGroupMember` (NOT via `UserGroup.leaderId`), matching the historical
 * `buildScopeFilter` behavior in `lib/queries/bookings.ts` — a leader who was
 * never added as a member row of their own group will NOT be discovered here.
 * (`canAccessBooking` below uses a different, group-first discovery and is
 * intentionally NOT rewired onto this helper — see its comment.)
 *
 * When `profileId` belongs to no group, returns `[profileId]` (own-only) —
 * mirrors the legacy fallback so `{ [field]: { in: resolveGroupOwnerIds(...) } }`
 * stays behaviorally identical to the old `{ [field]: profileId }` shape.
 */
export async function resolveGroupOwnerIds(profileId: string): Promise<string[]> {
  const myGroups = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return [profileId];
  const groupIds = myGroups.map((g) => g.groupId);

  // Fetch all members + group leaders (defensive: covers legacy leaders who
  // weren't added as members before this fix was deployed)
  const [members, groupLeaders] = await Promise.all([
    db.userGroupMember.findMany({
      where: { groupId: { in: groupIds } },
      select: { userId: true },
    }),
    db.userGroup.findMany({
      where: { id: { in: groupIds }, leaderId: { not: null } },
      select: { leaderId: true },
    }),
  ]);

  const memberIds = new Set(members.map((m) => m.userId));
  for (const g of groupLeaders) {
    if (g.leaderId) memberIds.add(g.leaderId);
  }

  return [...memberIds];
}

/**
 * Generic dataScope WHERE builder, reusable across any entity with an
 * "owner" column (Booking.salesId today, Guestbook's ownerField later):
 *   - all   → {}
 *   - own   → { [ownerField]: profileId }
 *   - group → { [ownerField]: { in: resolveGroupOwnerIds(profileId) } }
 *
 * Mirrors the old `buildScopeFilter` edge cases exactly: missing profileId,
 * missing/"all" dataScope, and empty-group fallback all behave identically.
 */
export async function buildOwnerScopeWhere(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  ownerField: string,
): Promise<Record<string, unknown>> {
  if (!profileId || !dataScope || dataScope === "all") return {};
  if (dataScope === "own") return { [ownerField]: profileId };

  const ownerIds = await resolveGroupOwnerIds(profileId);
  return { [ownerField]: { in: ownerIds } };
}

/**
 * Check if user can access (read/write) a specific guestbook entry based on
 * dataScope. Mirrors `canAccessBooking` but keyed to `GuestbookEntry.salesId`
 * and — unlike `canAccessBooking` — deliberately uses `resolveGroupOwnerIds`
 * (membership-first) for the "group" branch so single-record access always
 * agrees with what `getGuestbookEntries` (query layer, also membership-first
 * via `buildOwnerScopeWhere`) already listed. A booking-style leader edge
 * case (leader never added as a member of their own group) is accepted here
 * for consistency — see `resolveGroupOwnerIds` doc comment.
 * - "all"   → always allowed
 * - "own"   → only entries where salesId === profileId
 * - "group" → entries where salesId is in resolveGroupOwnerIds(profileId)
 * - salesId null (unattributed entry) → only "all" scope can reach it
 */
export async function canAccessGuestbookEntry(
  profileId: string,
  dataScope: DataScope,
  entryId: string
): Promise<boolean> {
  if (dataScope === "all") return true;

  const entry = await db.guestbookEntry.findUnique({
    where: { id: entryId },
    select: { salesId: true },
  });
  if (!entry) return false;

  if (dataScope === "own") {
    return entry.salesId === profileId;
  }

  // group scope
  if (!entry.salesId) return false;
  const ownerIds = await resolveGroupOwnerIds(profileId);
  return ownerIds.includes(entry.salesId);
}
