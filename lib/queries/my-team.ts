import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

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

/** Fetch performance data semua member dalam satu group (all-time) */
export async function getMyTeamPerformance(groupId: string) {
  "use cache";
  cacheTag("my-team", "bookings");
  cacheLife("minutes");

  const group = await db.userGroup.findUnique({
    where: { id: groupId },
    select: { members: { select: { userId: true } } },
  });

  if (!group) return [];

  const memberIds = group.members.map((m) => m.userId);

  const [bookingAggs, targets] = await Promise.all([
    db.booking.groupBy({
      by: ["salesId", "bookingStatus"],
      where: {
        salesId: { in: memberIds },
        bookingStatus: { not: BookingStatus.Canceled },
      },
      _count: { id: true },
      _sum: { discountAmount: true },
    }),
    db.userTarget.findMany({
      where: { profileId: { in: memberIds }, type: "sales" },
      select: { profileId: true, amount: true },
    }),
  ]);

  const bookingRevenues = await db.booking.findMany({
    where: {
      salesId: { in: memberIds },
      bookingStatus: { not: BookingStatus.Canceled },
    },
    select: {
      salesId: true,
      bookingStatus: true,
      managerApprovedAt: true,
      snapPackageVariant: { select: { price: true } },
    },
  });

  return memberIds.map((profileId) => {
    const memberBookings = bookingRevenues.filter((b) => b.salesId === profileId);
    const confirmed = memberBookings.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
    const pending = memberBookings.filter((b) => b.bookingStatus === BookingStatus.Pending);
    const pendingApproval = pending.filter((b) => !b.managerApprovedAt);

    const actual = confirmed.reduce((sum, b) => sum + (b.snapPackageVariant?.price ?? 0), 0);
    const target = targets.find((t) => t.profileId === profileId);

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

/** Fetch bookings milik satu sales untuk detail drawer (all-time) */
export async function getSalesBookings(salesId: string) {
  "use cache";
  cacheTag("my-team", "bookings");
  cacheLife("minutes");

  return db.booking.findMany({
    where: { salesId },
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

/** Fetch all groups — for users with my-team:view-all permission */
export async function getAllGroups() {
  "use cache";
  cacheTag("my-team", "groups");
  cacheLife("minutes");

  return db.userGroup.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Fetch groups where profileId is leader OR member */
export async function getUserGroups(profileId: string) {
  "use cache";
  cacheTag("my-team", "groups");
  cacheLife("minutes");

  return db.userGroup.findMany({
    where: {
      OR: [
        { leaderId: profileId },
        { members: { some: { userId: profileId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

/** Fetch a single group by ID with full member list (for detail page) */
export async function getGroupDetail(groupId: string) {
  "use cache";
  cacheTag("my-team", "groups");
  cacheLife("minutes");

  return db.userGroup.findUnique({
    where: { id: groupId },
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

// ─── Return types ─────────────────────────────────────────────────────────────

export type MyTeamGroup = Awaited<ReturnType<typeof getMyTeamGroup>>;
export type MyTeamPerformanceItem = Awaited<ReturnType<typeof getMyTeamPerformance>>[number];
export type SalesBookingItem = Awaited<ReturnType<typeof getSalesBookings>>[number];
export type AvailableSalesProfile = Awaited<ReturnType<typeof getAvailableSalesProfiles>>[number];
export type GroupCard = Awaited<ReturnType<typeof getAllGroups>>[number];
export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;
