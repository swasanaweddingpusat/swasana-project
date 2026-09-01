import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";
import { resolveAvatarUrl } from "@/lib/storage";
import {
  getUserGroups,
  getAllGroups,
  getGroupPerformanceForGroups,
} from "@/lib/queries/groups";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number;
  pendingBookings: number;
  lostBookings: number;
}

export interface GroupAchievementData {
  id: string;
  name: string;
  leaderName: string;
  memberCount: number;
  revenue: number;
  target: number;
  confirmedBookings: number;
}

export interface SalesPerformanceItem {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  revenue: number;
  confirmedBookings: number;
  target: number;
}

export interface DashboardData {
  stats: DashboardStats;
  groups: GroupAchievementData[];
  salesLeaderboard: SalesPerformanceItem[];
}

/** Inclusive-from / exclusive-to date window (dealing-date or event-date). */
export interface DealingDateRange {
  from: Date;
  to: Date;
}

// ─── Date range helpers ───────────────────────────────────────────────────────

/** Local calendar day (not UTC) — avoids the off-by-one from toISOString(). */
export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Shared day-string → { range, fromDay, toDay } resolver used by both
 * `resolveDealingRange` (createdAt) and `resolveEventRange` (eventDate).
 * There is intentionally NO default window: when neither param is present the
 * `range` is `undefined`, and the scoped section falls back to whole-database
 * (all-time) totals. The filter only narrows once a range is explicitly picked.
 */
function resolveDayRange(
  from: string | undefined,
  to: string | undefined,
): { range: DealingDateRange | undefined; fromDay: string; toDay: string } {
  if (!from && !to) {
    return { range: undefined, fromDay: "", toDay: "" };
  }
  const fromDay = from ?? to!;
  const toDay = to ?? fromDay;
  const fromDate = new Date(`${fromDay}T00:00:00`);
  const toDate = new Date(`${toDay}T00:00:00`);
  toDate.setDate(toDate.getDate() + 1); // exclusive upper bound — makes the whole `toDay` inclusive
  return { range: { from: fromDate, to: toDate }, fromDay, toDay };
}

/**
 * Resolves the `dealFrom`/`dealTo` search params (YYYY-MM-DD, calendar day)
 * into an optional { from, to } window (booking.createdAt) plus the day-strings
 * used for display.
 */
export function resolveDealingRange(
  dealFrom: string | undefined,
  dealTo: string | undefined,
): { range: DealingDateRange | undefined; fromDay: string; toDay: string } {
  return resolveDayRange(dealFrom, dealTo);
}

/**
 * Resolves the `eventFrom`/`eventTo` search params (YYYY-MM-DD, calendar day)
 * into an optional { from, to } window (booking.eventDate) plus the day-strings
 * used for display. Composes with `resolveDealingRange` via AND — both ranges
 * apply to the same `where` when both are given.
 */
export function resolveEventRange(
  eventFrom: string | undefined,
  eventTo: string | undefined,
): { range: DealingDateRange | undefined; fromDay: string; toDay: string } {
  return resolveDayRange(eventFrom, eventTo);
}

// ─── Stat cards query ────────────────────────────────────────────────────────

// Stat cards count saved bookings by status within the caller's access scope,
// optionally scoped to a dealing-date (createdAt) range and/or an event-date
// (eventDate) range — both AND together when given, falls back to
// whole-database totals when neither is given.
async function _queryBookingStats(
  salesIds: string[] | null,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<DashboardStats> {
  const where = {
    recordStatus: "saved" as const,
    ...(salesIds ? { salesId: { in: salesIds } } : {}),
    ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}),
    ...(eventRange ? { eventDate: { gte: eventRange.from, lt: eventRange.to } } : {}),
  };

  // Aggregate per status in the DB (one round-trip) instead of loading up to
  // 10k rows and counting in JS.
  const byStatus = await db.booking.groupBy({
    by: ["bookingStatus"],
    where,
    _count: { _all: true },
  });

  let total = 0;
  let pending = 0;
  let lost = 0;
  for (const row of byStatus) {
    const c = row._count._all;
    total += c;
    if (row.bookingStatus === BookingStatus.Pending) pending += c;
    else if (row.bookingStatus === BookingStatus.Lost || row.bookingStatus === BookingStatus.Canceled) lost += c;
  }

  return { totalBookings: total, pendingBookings: pending, lostBookings: lost };
}

async function getBookingStats(
  salesIds: string[] | null,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<DashboardStats> {
  "use cache";
  cacheTag("bookings");
  cacheLife("minutes");

  return _queryBookingStats(salesIds, range, eventRange);
}

export async function getBookingStatsRaw(
  salesIds: string[] | null,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<DashboardStats> {
  return _queryBookingStats(salesIds, range, eventRange);
}

// ─── Main dashboard data composer ────────────────────────────────────────────

// Group achievement uses the current-year annual target; revenue/bookings are
// scoped to the given dealing-date (createdAt) `range` when provided, else
// whole-database (all-time), consistent with the stat cards and top-sales list.
export async function getDashboardData(
  profileId: string | undefined,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<DashboardData> {
  const groups = profileId
    ? await getUserGroups(profileId)
    : await getAllGroups();

  // Batched per-group performance (single aggregation across every group) — the
  // previous per-group loop was an N+1 (3 DB round-trips per group).
  const performances = await getGroupPerformanceForGroups(
    groups.map((g) => g.id),
    range,
    eventRange,
  );

  const groupPerformances = groups.map((group) => ({
    group,
    members: performances.get(group.id) ?? [],
  }));

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
          avatarUrl: resolveAvatarUrl(m.avatarUrl),
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

  const stats = await getBookingStats(salesIds, range, eventRange);

  const salesLeaderboard = [...salesMap.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );

  return { stats, groups: dashboardGroups, salesLeaderboard };
}

// ─── Raw (uncached) query functions for API routes ──────────────────────────

async function _queryGroupsAndLeaderboard(
  profileId: string | undefined,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<{ groups: GroupAchievementData[]; leaderboard: SalesPerformanceItem[] }> {
  const groups = profileId
    ? await getUserGroups(profileId)
    : await getAllGroups();

  // Batched per-group performance (single aggregation across every group) — the
  // previous per-group loop was an N+1 (3 DB round-trips per group).
  const performances = await getGroupPerformanceForGroups(
    groups.map((g) => g.id),
    range,
    eventRange,
  );

  const groupPerformances = groups.map((group) => ({
    group,
    members: performances.get(group.id) ?? [],
  }));

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
          avatarUrl: resolveAvatarUrl(m.avatarUrl),
          revenue: m.actual,
          confirmedBookings: m.confirmed,
          target: m.target,
        });
      }
    }
  }

  const leaderboard = [...salesMap.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );

  return { groups: dashboardGroups, leaderboard };
}

export async function getGroupAchievementRaw(
  profileId: string | undefined,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<GroupAchievementData[]> {
  const { groups } = await _queryGroupsAndLeaderboard(profileId, range, eventRange);
  return groups;
}

// Leaderboard route is dead code (not rendered on the dashboard) — kept
// compiling/consistent with the shared internal query, but never passed a
// dealing-date range in practice.
export async function getSalesLeaderboardRaw(
  profileId: string | undefined,
  range?: DealingDateRange,
  eventRange?: DealingDateRange,
): Promise<SalesPerformanceItem[]> {
  const { leaderboard } = await _queryGroupsAndLeaderboard(profileId, range, eventRange);
  return leaderboard;
}
