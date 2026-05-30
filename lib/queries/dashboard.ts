import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import {
  getUserGroups,
  getAllGroups,
  getGroupPerformance,
} from "@/lib/queries/groups";
import type { GroupAchievementData } from "@/app/(private)/dashboard/_components/group-achievement-section";
import type { SalesPerformanceItem } from "@/app/(private)/dashboard/_components/sales-leaderboard";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  pendingBookings: number;
  lostBookings: number;
}

export interface DashboardData {
  stats: DashboardStats;
  groups: GroupAchievementData[];
  salesLeaderboard: SalesPerformanceItem[];
}

// ─── Stat cards query ────────────────────────────────────────────────────────

async function getBookingStats(
  salesIds: string[] | null,
  startDate: Date,
  endDate: Date,
): Promise<DashboardStats> {
  "use cache";
  cacheTag("bookings");
  cacheLife("minutes");

  const bookings = await db.booking.findMany({
    where: {
      bookingDate: { gte: startDate, lte: endDate },
      ...(salesIds ? { salesId: { in: salesIds } } : {}),
    },
    select: {
      bookingStatus: true,
      snapPackagePricing: { select: { price: true } },
    },
    take: 10000,
  });

  return {
    totalBookings: bookings.length,
    totalRevenue: bookings
      .filter((b) => b.bookingStatus === BookingStatus.Confirmed)
      .reduce((sum, b) => sum + (b.snapPackagePricing?.price ?? 0), 0),
    pendingBookings: bookings.filter(
      (b) => b.bookingStatus === BookingStatus.Pending,
    ).length,
    lostBookings: bookings.filter(
      (b) =>
        b.bookingStatus === BookingStatus.Lost ||
        b.bookingStatus === BookingStatus.Canceled,
    ).length,
  };
}

// ─── Main dashboard data composer ────────────────────────────────────────────

export async function getDashboardData(
  profileId: string | undefined,
  startDate: Date,
  endDate: Date,
): Promise<DashboardData> {
  const groups = profileId
    ? await getUserGroups(profileId)
    : await getAllGroups();

  const groupPerformances = await Promise.all(
    groups.map(async (g) => ({
      group: g,
      members: await getGroupPerformance(g.id, startDate, endDate),
    })),
  );

  const dashboardGroups: GroupAchievementData[] = groupPerformances.map(
    ({ group, members }) => ({
      id: group.id,
      name: group.name,
      leaderName: group.leader?.fullName ?? "—",
      memberCount: group._count.members,
      revenue: members.reduce((s, m) => s + m.actual, 0),
      target: members.reduce((s, m) => s + m.target, 0),
      confirmedBookings: members.reduce((s, m) => s + m.confirmed, 0),
    }),
  );

  const salesMap = new Map<string, SalesPerformanceItem>();
  for (const { members } of groupPerformances) {
    for (const m of members) {
      if (!salesMap.has(m.profileId)) {
        salesMap.set(m.profileId, {
          profileId: m.profileId,
          name: m.fullName ?? "—",
          avatarUrl: m.avatarUrl ?? null,
          revenue: m.actual,
          confirmedBookings: m.confirmed,
          target: m.target,
        });
      }
    }
  }

  const salesIds = salesMap.size > 0 && profileId
    ? [...salesMap.keys()]
    : null;

  const stats = await getBookingStats(salesIds, startDate, endDate);

  const salesLeaderboard = [...salesMap.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );

  return { stats, groups: dashboardGroups, salesLeaderboard };
}
