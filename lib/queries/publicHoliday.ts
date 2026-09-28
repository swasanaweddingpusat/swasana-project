import { cacheTag, cacheLife } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function getPublicHolidays() {
  "use cache";
  cacheTag("public-holidays");
  cacheLife("minutes");

  return db.publicHoliday.findMany({
    select: { id: true, date: true, name: true, isActive: true, createdAt: true },
    orderBy: { date: "asc" },
    take: 500,
  });
}

export type PublicHolidaysResult = Awaited<ReturnType<typeof getPublicHolidays>>;
export type PublicHolidayItem = PublicHolidaysResult[number];

/**
 * Holiday-token balance for a profile. A token is now an explicit ledger row
 * (HolidayTokenGrant) HRD issues to a specific profile for a specific active
 * PublicHoliday — no longer auto-derived from every active holiday. Available
 * = granted minus already-referenced via an active (pending/manager_approved/
 * approved) holiday-token LeaveRequest. Not cached with "use cache" (unlike
 * getPublicHolidays) since it must reflect the profile's in-flight
 * submissions/cancellations immediately.
 */
export async function getAvailableHolidayTokens(profileId: string) {
  const grants = await db.holidayTokenGrant.findMany({
    where: { profileId, publicHoliday: { isActive: true } },
    select: {
      publicHolidayId: true,
      publicHolidayName: true,
      publicHoliday: { select: { date: true } },
    },
    orderBy: { grantedAt: "asc" },
    take: 500,
  });

  if (grants.length === 0) return [];

  const usedRequests = await db.leaveRequest.findMany({
    where: {
      profileId,
      publicHolidayId: { in: grants.map((g) => g.publicHolidayId) },
      status: { in: ["pending", "manager_approved", "approved"] },
    },
    select: { publicHolidayId: true },
  });
  const usedHolidayIds = new Set(usedRequests.map((r) => r.publicHolidayId));

  return grants
    .filter((g) => !usedHolidayIds.has(g.publicHolidayId))
    .map((g) => ({ id: g.publicHolidayId, name: g.publicHolidayName, date: g.publicHoliday.date }));
}

export type AvailableHolidayTokensResult = Awaited<ReturnType<typeof getAvailableHolidayTokens>>;
export type AvailableHolidayTokenItem = AvailableHolidayTokensResult[number];

export interface HolidayTokenGrantsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface HolidayTokenGrantsResult {
  data: HolidayTokenGrantItem[];
  total: number;
  page: number;
  limit: number;
}

export interface HolidayTokenGrantItem {
  id: string;
  publicHolidayId: string;
  publicHolidayName: string;
  note: string | null;
  grantedAt: Date;
  profile: { id: string; fullName: string | null; employeeNumber: number };
  granter: { id: string; fullName: string | null } | null;
  holidayDate: Date;
  holidayIsActive: boolean;
  isUsed: boolean;
}

/**
 * Paginated list of holiday token grants for the HRD "Kelola Token" table.
 * isUsed is derived from a single batched LeaveRequest lookup (Set-based,
 * not N+1) against the (profileId, publicHolidayId) pairs on the current page.
 */
export async function getHolidayTokenGrants(params: HolidayTokenGrantsParams): Promise<HolidayTokenGrantsResult> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const where: Prisma.HolidayTokenGrantWhereInput = params.search
    ? {
        OR: [
          { profile: { fullName: { contains: params.search, mode: "insensitive" } } },
          { publicHolidayName: { contains: params.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.holidayTokenGrant.findMany({
      where,
      select: {
        id: true,
        publicHolidayId: true,
        publicHolidayName: true,
        note: true,
        grantedAt: true,
        profile: { select: { id: true, fullName: true, employeeNumber: true } },
        granter: { select: { id: true, fullName: true } },
        publicHoliday: { select: { date: true, isActive: true } },
      },
      orderBy: { grantedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.holidayTokenGrant.count({ where }),
  ]);

  if (rows.length === 0) return { data: [], total, page, limit };

  const usedRequests = await db.leaveRequest.findMany({
    where: {
      profileId: { in: rows.map((r) => r.profile.id) },
      publicHolidayId: { in: rows.map((r) => r.publicHolidayId) },
      status: { in: ["pending", "manager_approved", "approved"] },
    },
    select: { profileId: true, publicHolidayId: true },
  });
  const usedKeys = new Set(usedRequests.map((r) => `${r.profileId}:${r.publicHolidayId}`));

  const data: HolidayTokenGrantItem[] = rows.map((r) => ({
    id: r.id,
    publicHolidayId: r.publicHolidayId,
    publicHolidayName: r.publicHolidayName,
    note: r.note,
    grantedAt: r.grantedAt,
    profile: r.profile,
    granter: r.granter,
    holidayDate: r.publicHoliday.date,
    holidayIsActive: r.publicHoliday.isActive,
    isUsed: usedKeys.has(`${r.profile.id}:${r.publicHolidayId}`),
  }));

  return { data, total, page, limit };
}
