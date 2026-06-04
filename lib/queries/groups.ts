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
          profile: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              role: { select: { name: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ─── Performance queries ──────────────────────────────────────────────────────

export async function getGroupPerformance(groupId: string, startDate?: Date, endDate?: Date) {
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
            recordStatus: "saved",
            salesId: profileId,
            bookingStatus: { not: BookingStatus.Canceled },
            ...(startDate && endDate ? { bookingDate: { gte: startDate, lte: endDate } } : {}),
          },
          select: {
            bookingStatus: true,
            snapPackagePricing: { select: { price: true } },
          },
          take: 1000,
        }),
        db.userTarget.findFirst({
          where: {
            profileId,
            type: "sales",
            ...(startDate && endDate
              ? { startDate: { lte: endDate }, endDate: { gte: startDate } }
              : {}),
          },
          orderBy: { endDate: "desc" },
          select: { amount: true, startDate: true, endDate: true },
        }),
      ]);

      const confirmed = bookingRevenues.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
      const pendingApproval = bookingRevenues.filter((b) => b.bookingStatus === BookingStatus.Pending);
      const actual = confirmed.reduce((sum, b) => sum + (b.snapPackagePricing?.price ?? 0), 0);
      const targetAmount = target ? Number(target.amount) : 0;
      const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

      return {
        profileId,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        actual,
        target: targetAmount,
        targetStartDate: target?.startDate?.toISOString() ?? null,
        targetEndDate: target?.endDate?.toISOString() ?? null,
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
  startDate?: Date,
  endDate?: Date,
) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  // ── Query 1: fetch groups + members in one shot ─────────────────────────────
  const groupsWithMembers = await db.userGroup.findMany({
    where: profileId
      ? {
          OR: [
            { leaderId: profileId },
            { members: { some: { userId: profileId } } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
      members: {
        select: { userId: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  if (groupsWithMembers.length === 0) return [];

  // Collect all unique salesIds across every group
  const allSalesIds = [
    ...new Set(groupsWithMembers.flatMap((g) => g.members.map((m) => m.userId))),
  ];

  // ── Query 2: all relevant bookings in one shot ───────────────────────────────
  const allBookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      salesId: { in: allSalesIds },
      bookingStatus: { not: BookingStatus.Canceled },
      ...(startDate && endDate ? { bookingDate: { gte: startDate, lte: endDate } } : {}),
    },
    select: {
      id: true,
      salesId: true,
      bookingStatus: true,
      snapPackagePricing: { select: { price: true } },
      termOfPayments: {
        select: {
          amount: true,
          paymentStatus: true,
          ackStatus: true,
          partialPayments: { select: { amount: true } },
        },
      },
    },
    take: 10000,
  });

  // ── Query 3: all relevant targets in one shot ────────────────────────────────
  // Fetch latest target per sales profile (no date overlap filter for all-time view)
  const allTargets = await db.userTarget.findMany({
    where: {
      profileId: { in: allSalesIds },
      type: "sales",
      ...(startDate && endDate
        ? { startDate: { lte: endDate }, endDate: { gte: startDate } }
        : {}),
    },
    orderBy: { endDate: "desc" },
    select: { profileId: true, amount: true },
  });

  // ── In-memory aggregation ────────────────────────────────────────────────────

  // Helper: compute piutang (outstanding) and totalRevenue for a booking's TOPs
  function computeTopFinancials(tops: typeof allBookings[number]["termOfPayments"]): {
    piutang: number;
    totalRevenue: number;
  } {
    let piutang = 0;
    let totalRevenue = 0;

    for (const top of tops) {
      const amount = Number(top.amount);
      const paidSoFar = top.partialPayments.reduce((s, p) => s + Number(p.amount), 0);

      if (top.paymentStatus === "refund") {
        // Refund = uang dikembalikan ke customer. Bukan piutang, bukan revenue.
        // Di-exclude dari kedua sisi agar konsisten dengan ar.ts yang memperlakukan
        // refund sebagai "settled" (deriveTerminStatus: refund → "paid").
        continue;
      }

      if (top.paymentStatus === "paid" && top.ackStatus === "acknowledged") {
        // Cash-based revenue: fully paid + acknowledged
        totalRevenue += amount;
      } else if (top.paymentStatus === "paid" && top.ackStatus !== "acknowledged") {
        // Paid but not yet acked → still piutang (waiting finance confirmation)
        piutang += amount;
      } else if (top.paymentStatus === "partial") {
        // Partial: remaining outstanding amount
        piutang += Math.max(0, amount - paidSoFar);
      } else if (top.paymentStatus === "unpaid") {
        // Unpaid: full amount is piutang
        piutang += amount;
      }
    }

    return { piutang, totalRevenue };
  }

  // Group bookings by salesId
  const bookingsBySalesId = new Map<
    string,
    {
      bookingStatus: BookingStatus;
      price: number;
      tops: typeof allBookings[number]["termOfPayments"];
    }[]
  >();
  for (const b of allBookings) {
    if (!b.salesId) continue;
    const list = bookingsBySalesId.get(b.salesId) ?? [];
    list.push({
      bookingStatus: b.bookingStatus,
      price: b.snapPackagePricing?.price ?? 0,
      tops: b.termOfPayments,
    });
    bookingsBySalesId.set(b.salesId, list);
  }

  // Map target by profileId — first-write-wins because allTargets is ordered by endDate desc
  // so the first entry per profileId is the latest (most recent) target
  const targetBySalesId = new Map<string, number>();
  for (const t of allTargets) {
    if (!targetBySalesId.has(t.profileId)) {
      targetBySalesId.set(t.profileId, Number(t.amount));
    }
  }

  return groupsWithMembers.map((g) => {
    let revenue = 0;
    let target = 0;
    let confirmedCount = 0;
    let totalAchievement = 0;
    let memberCount = 0;
    let piutang = 0;
    let totalRevenue = 0;

    for (const member of g.members) {
      const bookings = bookingsBySalesId.get(member.userId) ?? [];
      const confirmed = bookings.filter((b) => b.bookingStatus === BookingStatus.Confirmed);
      const actual = confirmed.reduce((s, b) => s + b.price, 0);
      const targetAmount = targetBySalesId.get(member.userId) ?? 0;
      const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

      revenue += actual;
      target += targetAmount;
      confirmedCount += confirmed.length;
      totalAchievement += achievement;
      memberCount += 1;

      // Finance metrics: only Confirmed bookings (recordStatus=saved already filtered)
      for (const booking of confirmed) {
        const fin = computeTopFinancials(booking.tops);
        piutang += fin.piutang;
        totalRevenue += fin.totalRevenue;
      }
    }

    const avgAchievement = memberCount > 0 ? Math.round(totalAchievement / memberCount) : 0;

    // Spread g without members (keep shape: id, name, description, leaderId, leader, _count)
    const { members: _members, ...groupBase } = g;
    return {
      ...groupBase,
      revenue,
      target,
      avgAchievement,
      confirmedCount,
      piutang,
      totalRevenue,
    };
  });
}

// ─── Member management helpers ────────────────────────────────────────────────

export async function getSalesBookings(salesId: string, take = 100, skip = 0) {
  "use cache";
  cacheTag("groups", "bookings");
  cacheLife("minutes");

  return db.booking.findMany({
    where: { salesId, recordStatus: "saved" },
    select: {
      id: true,
      bookingStatus: true,
      poNumber: true,
      weddingSession: true,
      bookingDate: true,
      snapCustomer: { select: { name: true, mobileNumber: true } },
      snapVenue: { select: { venueName: true } },
      snapPackage: { select: { packageName: true } },
      snapPackagePricing: { select: { price: true } },
      paymentMethod: { select: { bankName: true } },
    },
    orderBy: { bookingDate: "desc" },
    take,
    skip,
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
    select: { id: true, fullName: true, avatarUrl: true, email: true },
    orderBy: { fullName: "asc" },
    take: 200,
  });
}

export async function getEligibleLeaders() {
  "use cache";
  cacheTag("groups", "users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: { status: "active" },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      email: true,
      role: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
    take: 500,
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
export type EligibleLeader = Awaited<ReturnType<typeof getEligibleLeaders>>[number];
