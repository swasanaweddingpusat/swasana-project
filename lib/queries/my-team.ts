import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyTeamPeriod {
  startDate: Date;
  endDate: Date;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Fetch group yang dipimpin oleh profileId (leaderId) */
export async function getMyTeamGroup(profileId: string) {
  "use cache";
  cacheTag("my-team", "groups");
  cacheLife("minutes");

  return db.userGroup.findFirst({
    where: { leaderId: profileId },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      members: {
        select: {
          userId: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/** Fetch performance data semua member dalam satu group untuk periode tertentu */
export async function getMyTeamPerformance(groupId: string, period: MyTeamPeriod) {
  "use cache";
  cacheTag("my-team", "bookings");
  cacheLife("minutes");

  const group = await db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (!group) return [];

  const memberIds = group.members.map((m) => m.userId);

  // Fetch bookings + targets untuk semua member sekaligus
  const [bookingAggs, targets] = await Promise.all([
    db.booking.groupBy({
      by: ["salesId", "bookingStatus"],
      where: {
        salesId: { in: memberIds },
        bookingDate: { gte: period.startDate, lte: period.endDate },
        bookingStatus: { not: BookingStatus.Canceled },
      },
      _count: { id: true },
      _sum: { discountAmount: true },
    }),
    db.userTarget.findMany({
      where: {
        profileId: { in: memberIds },
        type: "sales",
        startDate: { lte: period.endDate },
        endDate: { gte: period.startDate },
      },
      select: { profileId: true, amount: true },
    }),
  ]);

  // Fetch actual revenue dari snapPackageVariant.price
  const bookingRevenues = await db.booking.findMany({
    where: {
      salesId: { in: memberIds },
      bookingDate: { gte: period.startDate, lte: period.endDate },
      bookingStatus: { not: BookingStatus.Canceled },
    },
    select: {
      salesId: true,
      bookingStatus: true,
      managerApprovedAt: true,
      snapPackageVariant: { select: { price: true } },
    },
  });

  // Aggregate per member
  return memberIds.map((profileId) => {
    const memberBookings = bookingRevenues.filter((b) => b.salesId === profileId);
    const confirmed = memberBookings.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
    const pending = memberBookings.filter((b) => b.bookingStatus === BookingStatus.Pending);
    const pendingApproval = pending.filter((b) => !b.managerApprovedAt);

    const actual = confirmed.reduce((sum, b) => sum + (b.snapPackageVariant?.price ?? 0), 0);
    const target = targets.find((t) => t.profileId === profileId);

    // Count per status dari groupBy result
    const statusCounts = bookingAggs.filter((a) => a.salesId === profileId);
    const totalBookings = statusCounts.reduce((sum, a) => sum + a._count.id, 0);
    const confirmedCount = statusCounts.find((a) => a.bookingStatus === BookingStatus.Confirmed)?._count.id ?? 0;

    return {
      profileId,
      actual,
      target: target ? Number(target.amount) : 0,
      bookings: totalBookings,
      confirmed: confirmedCount,
      pendingApproval: pendingApproval.length,
    };
  });
}

/** Fetch bookings milik satu sales untuk detail drawer */
export async function getSalesBookings(salesId: string, period: MyTeamPeriod) {
  "use cache";
  cacheTag("my-team", "bookings");
  cacheLife("minutes");

  return db.booking.findMany({
    where: {
      salesId,
      bookingDate: { gte: period.startDate, lte: period.endDate },
    },
    select: {
      id: true,
      bookingStatus: true,
      poNumber: true,
      weddingSession: true,
      managerApprovedAt: true,
      managerSignature: true,
      bookingDate: true,
      snapCustomer: { select: { name: true, mobileNumber: true } },
      snapVenue: { select: { venueName: true } },
      snapPackage: { select: { packageName: true } },
      snapPackageVariant: { select: { price: true } },
      paymentMethod: { select: { bankName: true } },
    },
    orderBy: { bookingDate: "desc" },
  });
}

/** Fetch semua profiles yang bisa ditambahkan ke team (belum jadi member, role sales) */
export async function getAvailableSalesProfiles(excludeIds: string[]) {
  "use cache";
  cacheTag("my-team", "users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: {
      id: { notIn: excludeIds },
      status: "active",
      role: { name: "sales" },
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
  });
}

// ─── Return types ─────────────────────────────────────────────────────────────

export type MyTeamGroup = Awaited<ReturnType<typeof getMyTeamGroup>>;
export type MyTeamPerformanceItem = Awaited<ReturnType<typeof getMyTeamPerformance>>[number];
export type SalesBookingItem = Awaited<ReturnType<typeof getSalesBookings>>[number];
export type AvailableSalesProfile = Awaited<ReturnType<typeof getAvailableSalesProfiles>>[number];
