import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { resolveAvatarUrl } from "@/lib/storage";

// ─── Paginated list (used by settings & API) ──────────────────────────────────

export async function getGroups(page = 1, limit = 10, userId?: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const skip = (page - 1) * limit;
  const where = userId ? { members: { some: { userId } } } : undefined;

  const [data, total] = await Promise.all([
    db.userGroup.findMany({
      where,
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
    db.userGroup.count({ where }),
  ]);

  const resolved = data.map((g) => ({
    ...g,
    leader: g.leader ? { ...g.leader, avatarUrl: resolveAvatarUrl(g.leader.avatarUrl) } : null,
    members: g.members.map((m) => ({
      ...m,
      profile: { ...m.profile, avatarUrl: resolveAvatarUrl(m.profile.avatarUrl) },
    })),
  }));

  return { data: resolved, total, page, limit };
}

export async function getGroupById(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const g = await db.userGroup.findUnique({
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

  if (!g) return null;

  return {
    ...g,
    leader: g.leader ? { ...g.leader, avatarUrl: resolveAvatarUrl(g.leader.avatarUrl) } : null,
    members: g.members.map((m) => ({
      ...m,
      profile: { ...m.profile, avatarUrl: resolveAvatarUrl(m.profile.avatarUrl) },
    })),
  };
}

// ─── Lightweight list (used by index page) ────────────────────────────────────

export async function getAllGroups() {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const groups = await db.userGroup.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      leaderId: true,
      leader: { select: { fullName: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return groups.map((g) => ({
    ...g,
    leader: g.leader ? { ...g.leader, avatarUrl: resolveAvatarUrl(g.leader.avatarUrl) } : null,
  }));
}

export async function getUserGroups(profileId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const groups = await db.userGroup.findMany({
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
    take: 200,
  });

  return groups.map((g) => ({
    ...g,
    leader: g.leader ? { ...g.leader, avatarUrl: resolveAvatarUrl(g.leader.avatarUrl) } : null,
  }));
}

export async function getGroupDetail(groupId: string) {
  "use cache";
  cacheTag("groups");
  cacheLife("minutes");

  const g = await db.userGroup.findUnique({
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

  if (!g) return null;

  return {
    ...g,
    members: g.members.map((m) => ({
      ...m,
      profile: { ...m.profile, avatarUrl: resolveAvatarUrl(m.profile.avatarUrl) },
    })),
  };
}

// ─── Performance queries ──────────────────────────────────────────────────────

// ─── Raw query row types ──────────────────────────────────────────────────────

type BookingAggRow = {
  sales_id: string;
  total_bookings: bigint;
  confirmed_count: bigint;
  pending_count: bigint;
  revenue: bigint | null;
};

type FinancialAggRow = {
  sales_id: string;
  piutang: bigint;
  total_revenue: bigint;
};

export async function getMemberAnnualTargets(profileId: string) {
  // No "use cache" here — this function is called from an API route handler,
  // not an RSC. Server-action revalidateTag does not reliably bust "use cache"
  // entries accessed via API routes. Client-side caching is handled by TanStack
  // Query (queryKey: ["member-annual-targets", profileId]).
  const targets = await db.userTarget.findMany({
    where: { profileId, type: "sales" },
    orderBy: { year: "desc" },
    select: { year: true, amount: true },
    take: 20,
  });

  return targets.map((t) => ({ year: t.year, amount: Number(t.amount) }));
}

export async function getGroupPerformance(groupId: string, startDate?: Date, endDate?: Date, year?: number) {
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

  const profileIds = group.members.map((m) => m.userId);
  if (profileIds.length === 0) return [];

  const dateFilter =
    startDate && endDate
      ? Prisma.sql`AND b."eventDate" >= ${startDate} AND b."eventDate" < ${endDate}`
      : Prisma.empty;

  // Derive target year: use explicit year param, else derive from startDate, else current year
  const targetYear = year ?? (startDate ? startDate.getFullYear() : new Date().getFullYear());

  const [bookingAgg, targets] = await Promise.all([
    db.$queryRaw<BookingAggRow[]>`
      SELECT
        b."salesId"                                                              AS sales_id,
        COUNT(b.id)                                                              AS total_bookings,
        COUNT(b.id) FILTER (WHERE b."bookingStatus" = 'Confirmed')              AS confirmed_count,
        COUNT(b.id) FILTER (WHERE b."bookingStatus" = 'Pending')                AS pending_count,
        SUM(spp.price)  FILTER (WHERE b."bookingStatus" = 'Confirmed')          AS revenue
      FROM bookings b
      LEFT JOIN snap_package_pricing spp ON spp."bookingId" = b.id
      WHERE
        b."recordStatus" = 'saved'
        AND b."salesId" = ANY(${profileIds})
        AND b."bookingStatus" != 'Canceled'
        ${dateFilter}
      GROUP BY b."salesId"
    `,
    db.userTarget.findMany({
      where: { profileId: { in: profileIds }, type: "sales", year: targetYear },
      select: { profileId: true, amount: true },
    }),
  ]);

  // Map target by profileId for the given year
  const targetBySalesId = new Map<string, number>();
  for (const t of targets) {
    targetBySalesId.set(t.profileId, Number(t.amount));
  }

  const aggBySalesId = new Map<string, BookingAggRow>();
  for (const row of bookingAgg) {
    aggBySalesId.set(row.sales_id, row);
  }

  const results = group.members.map(({ userId: profileId, profile }) => {
    const agg = aggBySalesId.get(profileId);
    const actual = agg?.revenue ? Number(agg.revenue) : 0;
    const totalBookings = agg ? Number(agg.total_bookings) : 0;
    const confirmed = agg ? Number(agg.confirmed_count) : 0;
    const pendingApproval = agg ? Number(agg.pending_count) : 0;
    const targetAmount = targetBySalesId.get(profileId) ?? 0;
    const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

    return {
      profileId,
      fullName: profile.fullName,
      avatarUrl: resolveAvatarUrl(profile.avatarUrl),
      actual,
      target: targetAmount,
      achievement,
      bookings: totalBookings,
      confirmed,
      pendingApproval,
    };
  });

  return results.sort((a, b) => b.actual - a.actual);
}

export async function getGroupsWithPerformance(
  profileId: string | undefined,
  startDate?: Date,
  endDate?: Date,
  year?: number,
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

  const dateFilter =
    startDate && endDate
      ? Prisma.sql`AND b."eventDate" >= ${startDate} AND b."eventDate" < ${endDate}`
      : Prisma.empty;

  // ── Query 2: DB-level booking aggregation per salesId ───────────────────────
  // Revenue = SUM of snapPackagePricing.price for Confirmed bookings only
  // Counts = total active bookings, confirmed, pending (Pending = awaiting approval)
  const [bookingAgg, financialAgg, allTargets] = await Promise.all([
    db.$queryRaw<BookingAggRow[]>`
      SELECT
        b."salesId"                                                              AS sales_id,
        COUNT(b.id)                                                              AS total_bookings,
        COUNT(b.id) FILTER (WHERE b."bookingStatus" = 'Confirmed')              AS confirmed_count,
        COUNT(b.id) FILTER (WHERE b."bookingStatus" = 'Pending')                AS pending_count,
        SUM(spp.price)  FILTER (WHERE b."bookingStatus" = 'Confirmed')          AS revenue
      FROM bookings b
      LEFT JOIN snap_package_pricing spp ON spp."bookingId" = b.id
      WHERE
        b."recordStatus" = 'saved'
        AND b."salesId" = ANY(${allSalesIds})
        AND b."bookingStatus" != 'Canceled'
        ${dateFilter}
      GROUP BY b."salesId"
    `,
    // ── Query 3: DB-level financial aggregation per salesId (pure-derived §Fase 5) ─
    // Raw SQL used here instead of JS helper (computeTopFinancials) to collapse the
    // aggregation into a single DB round-trip. "Terbayar" per termin HANYA dari Ledger
    // cash-in ter-ack (kolom TOP.paymentStatus/ackStatus sudah di-drop).
    //   effectiveKas = LEAST(Σ ledger_paid, t.amount)   → total_revenue (kas)
    //   piutang      = GREATEST(0, t.amount - effectiveKas)
    db.$queryRaw<FinancialAggRow[]>`
      SELECT
        b."salesId"  AS sales_id,
        COALESCE(SUM(
          GREATEST(0, t.amount - LEAST(COALESCE(ledger_sum.ledger_paid, 0), t.amount))
        ), 0)        AS piutang,
        COALESCE(SUM(
          LEAST(COALESCE(ledger_sum.ledger_paid, 0), t.amount)
        ), 0)        AS total_revenue
      FROM bookings b
      JOIN term_of_payments t ON t."bookingId" = b.id
      LEFT JOIN (
        SELECT pa."termId", SUM(pa.amount) AS ledger_paid
        FROM payment_allocations pa
        JOIN ledgers l ON l.id = pa."ledgerId"
        WHERE l.direction = 'in' AND l."ackStatus" = 'acknowledged' AND l."voidedAt" IS NULL
        GROUP BY pa."termId"
      ) ledger_sum ON ledger_sum."termId" = t.id
      WHERE
        b."recordStatus" = 'saved'
        AND b."salesId" = ANY(${allSalesIds})
        AND b."bookingStatus" != 'Canceled'
        ${dateFilter}
      GROUP BY b."salesId"
    `,
    // ── Query 4: all relevant targets for the target year ──────────────────
    // Derive target year: explicit year param → startDate year → current year
    (() => {
      const targetYear = year ?? (startDate ? startDate.getFullYear() : new Date().getFullYear());
      return db.userTarget.findMany({
        where: { profileId: { in: allSalesIds }, type: "sales", year: targetYear },
        select: { profileId: true, amount: true },
      });
    })(),
  ]);

  // ── In-memory map assembly (from aggregated DB rows) ─────────────────────────

  const aggBySalesId = new Map<string, BookingAggRow>();
  for (const row of bookingAgg) {
    aggBySalesId.set(row.sales_id, row);
  }

  const financialBySalesId = new Map<string, FinancialAggRow>();
  for (const row of financialAgg) {
    financialBySalesId.set(row.sales_id, row);
  }

  // Map target by profileId — one row per (profileId, type, year) after the migration
  const targetBySalesId = new Map<string, number>();
  for (const t of allTargets) {
    targetBySalesId.set(t.profileId, Number(t.amount));
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
      const agg = aggBySalesId.get(member.userId);
      const fin = financialBySalesId.get(member.userId);

      const actual = agg?.revenue ? Number(agg.revenue) : 0;
      const confirmed = agg ? Number(agg.confirmed_count) : 0;
      const targetAmount = targetBySalesId.get(member.userId) ?? 0;
      const achievement = targetAmount > 0 ? Math.round((actual / targetAmount) * 100) : 0;

      revenue += actual;
      target += targetAmount;
      confirmedCount += confirmed;
      totalAchievement += achievement;
      memberCount += 1;

      piutang += fin ? Number(fin.piutang) : 0;
      totalRevenue += fin ? Number(fin.total_revenue) : 0;
    }

    const avgAchievement = memberCount > 0 ? Math.round(totalAchievement / memberCount) : 0;

    // Spread g without members (keep shape: id, name, description, leaderId, leader, _count)
    const { members: _members, ...groupBase } = g;
    return {
      ...groupBase,
      leader: groupBase.leader ? { ...groupBase.leader, avatarUrl: resolveAvatarUrl(groupBase.leader.avatarUrl) } : null,
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

export async function getAvailableSalesProfiles(excludeIds: string[]) {
  "use cache";
  cacheTag("groups", "users");
  cacheLife("minutes");

  const profiles = await db.profile.findMany({
    where: {
      id: { notIn: excludeIds },
      status: "active",
    },
    select: { id: true, fullName: true, avatarUrl: true, email: true },
    orderBy: { fullName: "asc" },
    take: 200,
  });

  return profiles.map((p) => ({ ...p, avatarUrl: resolveAvatarUrl(p.avatarUrl) }));
}

export async function getEligibleLeaders() {
  "use cache";
  cacheTag("groups", "users");
  cacheLife("minutes");

  const profiles = await db.profile.findMany({
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

  return profiles.map((p) => ({ ...p, avatarUrl: resolveAvatarUrl(p.avatarUrl) }));
}

// ─── Return types ─────────────────────────────────────────────────────────────

export type GroupsQueryResult = Awaited<ReturnType<typeof getGroups>>;
export type GroupQueryItem = GroupsQueryResult["data"][number];
export type GroupCard = Awaited<ReturnType<typeof getAllGroups>>[number];
export type GroupDetail = Awaited<ReturnType<typeof getGroupDetail>>;
export type GroupPerformanceItem = Awaited<ReturnType<typeof getGroupPerformance>>[number];
export type GroupWithPerformance = Awaited<ReturnType<typeof getGroupsWithPerformance>>[number];
export type AvailableSalesProfile = Awaited<ReturnType<typeof getAvailableSalesProfiles>>[number];
export type EligibleLeader = Awaited<ReturnType<typeof getEligibleLeaders>>[number];
export type MemberAnnualTarget = Awaited<ReturnType<typeof getMemberAnnualTargets>>[number];
