import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { resolveAvatarUrl } from "@/lib/storage";
import { Prisma } from "@prisma/client";

// ─── Metrics from DailyActivity (leads table) ────────────────────────────────

interface RawMetricsRow {
  totalClientDihubungi: bigint;
  totalHotProspect: bigint;
  totalLeadsBaru: bigint;
  totalFollowUp: bigint;
  totalPotensiClosing: bigint;
  closingHariIni: bigint;
}

export async function getDailyReportMetrics(
  groupId: string,
  date: Date
): Promise<{
  totalClientDihubungi: number;
  totalHotProspect: number;
  totalLeadsBaru: number;
  totalFollowUp: number;
  totalPotensiClosing: number;
  closingHariIni: number;
}> {
  const members = await db.userGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  if (members.length === 0) {
    return {
      totalClientDihubungi: 0,
      totalHotProspect: 0,
      totalLeadsBaru: 0,
      totalFollowUp: 0,
      totalPotensiClosing: 0,
      closingHariIni: 0,
    };
  }

  const memberIds = members.map((m) => m.userId);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db.$queryRaw<RawMetricsRow[]>`
    SELECT
      COUNT(DISTINCT l.id) FILTER (WHERE l."updatedAt" >= ${dayStart} AND l."updatedAt" <= ${dayEnd}) AS "totalClientDihubungi",
      COUNT(DISTINCT l.id) FILTER (WHERE ls.name ILIKE '%hot%') AS "totalHotProspect",
      COUNT(DISTINCT l.id) FILTER (WHERE l."createdAt" >= ${dayStart} AND l."createdAt" <= ${dayEnd}) AS "totalLeadsBaru",
      COUNT(DISTINCT l.id) FILTER (WHERE ls.name ILIKE '%warm%' OR ls.name ILIKE '%follow%') AS "totalFollowUp",
      COUNT(DISTINCT l.id) FILTER (WHERE ls.name ILIKE '%hot%' AND l."updatedAt" >= ${dayStart} AND l."updatedAt" <= ${dayEnd}) AS "totalPotensiClosing",
      COUNT(DISTINCT l.id) FILTER (WHERE l."convertedAt" >= ${dayStart} AND l."convertedAt" <= ${dayEnd}) AS "closingHariIni"
    FROM leads l
    JOIN lead_statuses ls ON ls.id = l."statusId"
    WHERE l."assignedToId" = ANY(${memberIds}::text[])
  `;

  const row = rows[0];
  if (!row) {
    return {
      totalClientDihubungi: 0,
      totalHotProspect: 0,
      totalLeadsBaru: 0,
      totalFollowUp: 0,
      totalPotensiClosing: 0,
      closingHariIni: 0,
    };
  }

  return {
    totalClientDihubungi: Number(row.totalClientDihubungi),
    totalHotProspect: Number(row.totalHotProspect),
    totalLeadsBaru: Number(row.totalLeadsBaru),
    totalFollowUp: Number(row.totalFollowUp),
    totalPotensiClosing: Number(row.totalPotensiClosing),
    closingHariIni: Number(row.closingHariIni),
  };
}

// ─── Member completion status ─────────────────────────────────────────────────

export async function getMemberCompletionStatus(
  groupId: string,
  date: Date
): Promise<
  {
    profileId: string;
    fullName: string | null;
    avatarUrl: string | null;
    hasLoggedActivity: boolean;
  }[]
> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const members = await db.userGroupMember.findMany({
    where: { groupId },
    select: {
      userId: true,
      profile: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.userId);

  // Find distinct assignedToIds that logged activity on the target date
  const actives = await db.lead.findMany({
    where: {
      assignedToId: { in: memberIds },
      OR: [
        { createdAt: { gte: dayStart, lte: dayEnd } },
        { updatedAt: { gte: dayStart, lte: dayEnd } },
      ],
    },
    select: { assignedToId: true },
    distinct: ["assignedToId"],
  });

  const activeSet = new Set(actives.map((a) => a.assignedToId).filter(Boolean) as string[]);

  return members.map((m) => ({
    profileId: m.profile.id,
    fullName: m.profile.fullName,
    avatarUrl: resolveAvatarUrl(m.profile.avatarUrl),
    hasLoggedActivity: activeSet.has(m.userId),
  }));
}

// ─── Paginated list ───────────────────────────────────────────────────────────

const dailyReportSelect = {
  id: true,
  groupId: true,
  reportDate: true,
  totalClientDihubungi: true,
  totalHotProspect: true,
  totalLeadsBaru: true,
  totalFollowUp: true,
  totalPotensiClosing: true,
  closingHariIni: true,
  actionBesok: true,
  commitVisit: true,
  actualVisit: true,
  reason: true,
  kendala: true,
  membersCompleted: true,
  membersTotal: true,
  status: true,
  submittedById: true,
  createdAt: true,
  updatedAt: true,
  submittedBy: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.DailyReportSelect;

export async function getDailyReports(
  groupId: string,
  page = 1,
  limit = 20
): Promise<{
  data: Prisma.DailyReportGetPayload<{ select: typeof dailyReportSelect }>[];
  total: number;
  page: number;
  limit: number;
}> {
  "use cache";
  cacheTag("daily-report-manager");
  cacheLife("minutes");

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.dailyReport.findMany({
      where: { groupId },
      select: dailyReportSelect,
      orderBy: { reportDate: "desc" },
      skip,
      take: limit,
    }),
    db.dailyReport.count({ where: { groupId } }),
  ]);

  const resolved = data.map((r) => ({
    ...r,
    submittedBy: {
      ...r.submittedBy,
      avatarUrl: resolveAvatarUrl(r.submittedBy.avatarUrl),
    },
  }));

  return { data: resolved, total, page, limit };
}

// ─── Single report ────────────────────────────────────────────────────────────

export async function getDailyReportById(id: string) {
  return db.dailyReport.findUnique({
    where: { id },
    select: {
      ...dailyReportSelect,
      group: { select: { id: true, name: true } },
    },
  });
}

// ─── Manager's groups ─────────────────────────────────────────────────────────

export async function getManagerGroups(
  profileId: string
): Promise<{ id: string; name: string }[]> {
  return db.userGroup.findMany({
    where: { leaderId: profileId },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
}

// ─── Exported types ───────────────────────────────────────────────────────────

export type DailyReportListItem = Awaited<ReturnType<typeof getDailyReports>>["data"][number];
export type DailyReportMetrics = Awaited<ReturnType<typeof getDailyReportMetrics>>;
export type MemberCompletionItem = Awaited<ReturnType<typeof getMemberCompletionStatus>>[number];
