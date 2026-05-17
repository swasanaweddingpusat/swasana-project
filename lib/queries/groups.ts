import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

// ─── Paginated list (used by settings & API) ──────────────────────────────────

export async function getGroups(page = 1, limit = 10) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    db.userGroup.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        leaderId: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        leader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        members: {
          select: {
            userId: true,
            sortOrder: true,
            profile: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                role: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { members: true } },
      },
      orderBy: { sortOrder: "asc" },
      skip,
      take: limit,
    }),
    db.userGroup.count(),
  ]);

  return { data, total, page, limit };
}

export async function getGroupById(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  return db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      leader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      members: {
        select: {
          userId: true,
          sortOrder: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              role: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { members: true } },
    },
  });
}

// ─── Lightweight list (used by index page) ────────────────────────────────────

export async function getAllGroups() {
  "use cache";
  cacheTag("groups");
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

export async function getUserGroups(profileId: string) {
  "use cache";
  cacheTag("groups");
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

export async function getGroupDetail(groupId: string) {
  "use cache";
  cacheTag("groups");
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
          profile: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ─── Performance queries ──────────────────────────────────────────────────────

export async function getGroupPerformance(groupId: string, startDate: Date, endDate: Date) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  const group = await db.userGroup.findUnique({
    where: { id: groupId },
    select: {
      members: {
        select: { userId: true, profile: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!group) return [];

  const results = await Promise.all(
    group.members.map(async ({ userId: profileId, profile }) => {
      const [bookingRevenues, target] = await Promise.all([
        db.booking.findMany({
          where: {
            salesId: profileId,
            bookingStatus: { not: BookingStatus.Canceled },
            bookingDate: { gte: startDate, lte: endDate },
          },
          select: {
            bookingStatus: true,
            snapPackageVariant: { select: { price: true } },
          },
          take: 1000,
        }),
        db.userTarget.findFirst({
          where: {
            profileId,
            type: "sales",
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
          select: { amount: true },
        }),
      ]);

      const confirmed = bookingRevenues.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
      const pendingApproval = bookingRevenues.filter((b) => b.bookingStatus === BookingStatus.Pending);
      const actual = confirmed.reduce((sum, b) => sum + (b.snapPackageVariant?.price ?? 0), 0);
      const targetAmount = target ? Number(target.amount) : 0;
      const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

      return {
        profileId,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        actual,
        target: targetAmount,
        achievement,
        bookings: bookingRevenues.length,
        confirmed: confirmed.length,
        pendingApproval: pendingApproval.length,
      };
    }),
  );

  return results.sort((a, b) => b.actual - a.actual);
}

export async function getGroupsWithPerformance(
  profileId: string | undefined,
  startDate: Date,
  endDate: Date,
) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  const groups = profileId ? await getUserGroups(profileId) : await getAllGroups();

  return Promise.all(
    groups.map(async (g) => {
      const perf = await getGroupPerformance(g.id, startDate, endDate);
      const revenue = perf.reduce((s, m) => s + m.actual, 0);
      const avgAchievement =
        perf.length > 0
          ? Math.round(perf.reduce((s, m) => s + m.achievement, 0) / perf.length)
          : 0;
      const confirmedCount = perf.reduce((s, m) => s + m.confirmed, 0);
      return { ...g, revenue, avgAchievement, confirmedCount };
    }),
  );
}

// ─── Member management helpers ────────────────────────────────────────────────

export async function getSalesBookings(salesId: string) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  return db.booking.findMany({
    where: { salesId },
    select: {
      id: true,
      bookingStatus: true,
      poNumber: true,
      weddingSession: true,
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

export async function getAvailableSalesProfiles(excludeIds: string[]) {
  "use cache";
  cacheTag("groups", "users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: {
      id: { notIn: excludeIds },
      status: "active",
    },
    select: { id: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
    take: 200,
  });
}

// ─── Return types ─────────────────────────────────────────────────────────────

export type GroupsQueryResult = Awaited<ReturnType<typeof getGroups>>;
export type GroupQueryItem = GroupsQueryResult["data"][number];
export type GroupCard = Awaited<ReturnType<typeof getAllGroups>>[number];
export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;
export type GroupPerformanceItem = Awaited<ReturnType<typeof getGroupPerformance>>[number];
export type GroupWithPerformance = Awaited<ReturnType<typeof getGroupsWithPerformance>>[number];
export type SalesBookingItem = Awaited<ReturnType<typeof getSalesBookings>>[number];
export type AvailableSalesProfile = Awaited<ReturnType<typeof getAvailableSalesProfiles>>[number];
