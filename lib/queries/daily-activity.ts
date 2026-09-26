import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { DailyActivityFilterInput } from "@/lib/validations/daily-activity";
import type { DataScope } from "@/types/user";

// ─── Daily Activity reads (new lean model → db.dailyActivity) ─────────────────
//
// The NEW Daily Activity feature (sales prospecting log). Legacy lead-picker
// reads live in lib/queries/leads.ts. Do not conflate the two.

const dailyActivitySelect = {
  id: true,
  salesId: true,
  activityDate: true,
  companyName: true,
  segmentId: true,
  sourceOfInformationId: true,
  sourceOfInformationDetail: true,
  bitrixId: true,
  contactName: true,
  phoneNumber: true,
  email: true,
  location: true,
  siteVisitAt: true,
  milestone: true,
  progressStatus: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  sales: { select: { id: true, fullName: true } },
  segment: { select: { id: true, name: true } },
  sourceOfInformation: { select: { id: true, name: true } },
} satisfies Prisma.DailyActivitySelect;

/**
 * Resolve the salesId filter the caller is allowed to see, based on dataScope.
 * Enforced from the server session, never from HTTP params. Returns {} for "all".
 */
async function resolveDailyActivityScopeFilter(
  callerProfileId: string,
  dataScope: DataScope,
): Promise<Prisma.DailyActivityWhereInput> {
  if (dataScope === "all") return {};
  if (dataScope === "own") return { salesId: callerProfileId };

  // dataScope === "group": everyone in the caller's group(s), plus group leaders.
  const myGroups = await db.userGroupMember.findMany({
    where: { userId: callerProfileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return { salesId: callerProfileId };

  const groupIds = myGroups.map((g) => g.groupId);
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

  const allowedIds = new Set(members.map((m) => m.userId));
  for (const g of groupLeaders) {
    if (g.leaderId) allowedIds.add(g.leaderId);
  }

  return { salesId: { in: [...allowedIds] } };
}

/** Filter fields shared by the paginated listing and the unpaginated export. */
export type DailyActivityWhereFilter = Omit<DailyActivityFilterInput, "page" | "pageSize">;

/**
 * Build the `where` clause shared by `getDailyActivities` and
 * `getDailyActivitiesForExport` — keeps the two reads in sync so the export
 * always matches exactly what the table filter would return.
 */
function buildDailyActivityWhere(
  filter: DailyActivityWhereFilter,
  dataScopeFilter: Prisma.DailyActivityWhereInput,
): Prisma.DailyActivityWhereInput {
  const {
    search,
    progressStatus,
    segmentId,
    salesId,
    activityDateFrom,
    activityDateTo,
    siteVisitFrom,
    siteVisitTo,
  } = filter;

  return {
    deletedAt: null,
    ...dataScopeFilter,
    ...(search?.trim() && {
      OR: [
        { companyName: { contains: search.trim(), mode: "insensitive" } },
        { contactName: { contains: search.trim(), mode: "insensitive" } },
        { milestone: { contains: search.trim(), mode: "insensitive" } },
      ],
    }),
    ...(progressStatus && { progressStatus }),
    ...(segmentId && { segmentId }),
    // salesId from param is an additional narrowing filter on top of dataScopeFilter
    ...(salesId && { salesId }),
    ...((activityDateFrom || activityDateTo) && {
      activityDate: {
        ...(activityDateFrom && { gte: new Date(`${activityDateFrom}T00:00:00`) }),
        ...(activityDateTo && { lte: new Date(`${activityDateTo}T23:59:59.999`) }),
      },
    }),
    ...((siteVisitFrom || siteVisitTo) && {
      siteVisitAt: {
        ...(siteVisitFrom && { gte: new Date(`${siteVisitFrom}T00:00:00`) }),
        ...(siteVisitTo && { lte: new Date(`${siteVisitTo}T23:59:59.999`) }),
      },
    }),
  };
}

export async function getDailyActivities(
  filter: DailyActivityFilterInput,
  caller?: { profileId: string; dataScope: DataScope },
) {
  // No "use cache": may receive an identity-scoped filter; caching a per-user
  // result without a per-user key would leak data across callers.
  const { page, pageSize, ...whereFilter } = filter;

  const dataScopeFilter = caller
    ? await resolveDailyActivityScopeFilter(caller.profileId, caller.dataScope)
    : {};

  const where = buildDailyActivityWhere(whereFilter, dataScopeFilter);

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.dailyActivity.findMany({
      where,
      select: dailyActivitySelect,
      orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.dailyActivity.count({ where }),
  ]);

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Hard cap on export rows — mirrors the guestbook/export pattern. Protects
// against an unbounded findMany() while comfortably covering real usage.
const DAILY_ACTIVITY_EXPORT_LIMIT = 5000;

/**
 * Same filter/scope as `getDailyActivities` but unpaginated — used by the
 * Excel export so the file always matches exactly what's active in the
 * table's filter, never a raw/unfiltered dump.
 */
export async function getDailyActivitiesForExport(
  filter: DailyActivityWhereFilter,
  caller?: { profileId: string; dataScope: DataScope },
) {
  const dataScopeFilter = caller
    ? await resolveDailyActivityScopeFilter(caller.profileId, caller.dataScope)
    : {};

  const where = buildDailyActivityWhere(filter, dataScopeFilter);

  return db.dailyActivity.findMany({
    where,
    select: dailyActivitySelect,
    orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
    take: DAILY_ACTIVITY_EXPORT_LIMIT,
  });
}

export async function getDailyActivityById(id: string) {
  return db.dailyActivity.findFirst({
    where: { id, deletedAt: null },
    select: dailyActivitySelect,
  });
}

/** Active segments for the Daily Activity segment dropdown. */
export async function getDailyActivitySegmentOptions() {
  "use cache";
  cacheTag("daily-activity-segments");
  cacheLife("minutes");

  return db.dailyActivitySegment.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
    take: 200,
  });
}

export type DailyActivitiesResult = Awaited<ReturnType<typeof getDailyActivities>>;
export type DailyActivityItem = DailyActivitiesResult["data"][number];
export type DailyActivitySegmentOption = Awaited<
  ReturnType<typeof getDailyActivitySegmentOptions>
>[number];
