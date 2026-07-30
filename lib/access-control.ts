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
