import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ProcurementFilterInput } from "@/lib/validations/procurement";

// ─── Select shapes ────────────────────────────────────────────────────────────

const procurementItemSelect = {
  id: true,
  tanggalPermintaan: true,
  namaBarang: true,
  jumlahBarang: true,
  sisaBarang: true,
  penggunaan: true,
  picPenerima: true,
  linkBarang: true,
  note: true,
  keterangan: true,
  keteranganAcara: true,
  weddingNote: true,
  nonWeddingNote: true,
  totalWedding: true,
  totalNonWedding: true,
  total: true,
  status: true,
  division: true,
  harga: true,
  pettyCash: true,
  buktiBelUrl: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  venue: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, nickName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ProcurementItemSelect;

// ─── Procurement Items ────────────────────────────────────────────────────────

export async function getProcurementList(filter: ProcurementFilterInput) {
  "use cache";
  cacheTag("procurement");
  cacheLife("seconds");

  const { search, venueId, division, status, dateFrom, dateTo, page, limit } = filter;

  const where: Prisma.ProcurementItemWhereInput = {
    ...(search && {
      OR: [
        { namaBarang: { contains: search, mode: "insensitive" as const } },
        { picPenerima: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(venueId && { venueId }),
    ...(division && { division: division as "HR" | "OPERATIONAL" | "IT" | "FINANCE" | "MICE" }),
    ...(status && { status: status as "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" }),
    ...((dateFrom || dateTo) && {
      tanggalPermintaan: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    }),
  };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    db.procurementItem.findMany({
      where,
      select: procurementItemSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.procurementItem.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProcurementById(id: string) {
  "use cache";
  cacheTag("procurement");
  cacheLife("seconds");

  return db.procurementItem.findUnique({
    where: { id },
    select: procurementItemSelect,
  });
}

export async function getProcurementSummary(venueId?: string) {
  "use cache";
  cacheTag("procurement");
  cacheLife("seconds");

  const where: Prisma.ProcurementItemWhereInput = venueId ? { venueId } : {};

  const [pending, approved, rejected, completed] = await Promise.all([
    db.procurementItem.count({ where: { ...where, status: "PENDING" } }),
    db.procurementItem.count({ where: { ...where, status: "APPROVED" } }),
    db.procurementItem.count({ where: { ...where, status: "REJECTED" } }),
    db.procurementItem.count({ where: { ...where, status: "COMPLETED" } }),
  ]);

  return {
    pending,
    approved,
    rejected,
    completed,
    total: pending + approved + rejected + completed,
  };
}

// ─── Announcements ────────────────────────────────────────────────────────────

const announcementSelect = {
  id: true,
  title: true,
  content: true,
  isActive: true,
  targetAudience: true,
  targetList: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ProcurementAnnouncementSelect;

export async function getActiveAnnouncements(venueId?: string, division?: string) {
  "use cache";
  cacheTag("procurement-announcements");
  cacheLife("minutes");

  return db.procurementAnnouncement.findMany({
    where: {
      isActive: true,
      OR: [
        { targetAudience: "ALL" },
        ...(venueId
          ? [{ targetAudience: "VENUE" as const, targetList: { has: venueId } }]
          : []),
        ...(division
          ? [{ targetAudience: "DIVISION" as const, targetList: { has: division } }]
          : []),
      ],
    },
    select: announcementSelect,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getAnnouncementList(page = 1, limit = 20) {
  "use cache";
  cacheTag("procurement-announcements");
  cacheLife("seconds");

  const [items, total] = await Promise.all([
    db.procurementAnnouncement.findMany({
      select: announcementSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.procurementAnnouncement.count(),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ─── Period Helpers ──────────────────────────────────────────────────────────

function periodToDateRange(period: string): { gte: Date; lt: Date } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5));
  const gte = new Date(year, month - 1, 1);
  const lt = new Date(year, month, 1); // JS Date handles month overflow (month 12 → next year Jan)
  return { gte, lt };
}

// ─── Summary by Venue ────────────────────────────────────────────────────────

export async function getProcurementSummaryByVenue(period?: string) {
  "use cache";
  cacheTag("procurement");
  cacheTag("procurement-budgets");
  cacheLife("seconds");

  const dateRange = period ? periodToDateRange(period) : null;

  const where: Prisma.ProcurementItemWhereInput = dateRange
    ? { tanggalPermintaan: dateRange }
    : {};

  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [countsRaw, budgets] = await Promise.all([
    Promise.all(
      venues.map(async (venue) => {
        const [pending, approved, rejected, completed, totalSpent] =
          await Promise.all([
            db.procurementItem.count({
              where: { ...where, venueId: venue.id, status: "PENDING" },
            }),
            db.procurementItem.count({
              where: { ...where, venueId: venue.id, status: "APPROVED" },
            }),
            db.procurementItem.count({
              where: { ...where, venueId: venue.id, status: "REJECTED" },
            }),
            db.procurementItem.count({
              where: { ...where, venueId: venue.id, status: "COMPLETED" },
            }),
            db.procurementItem.aggregate({
              where: {
                ...where,
                venueId: venue.id,
                status: { in: ["APPROVED", "COMPLETED"] },
              },
              _sum: { pettyCash: true },
            }),
          ]);
        return {
          venueId: venue.id,
          venueName: venue.name,
          pending,
          approved,
          rejected,
          completed,
          total: pending + approved + rejected + completed,
          totalSpent: Number(totalSpent._sum.pettyCash ?? 0),
        };
      })
    ),
    period
      ? db.procurementVenueBudget.findMany({
          where: { period },
          select: { venueId: true, budgetAmount: true },
        })
      : Promise.resolve([]),
  ]);

  const budgetMap = new Map<string, number>(
    budgets.map((b) => [b.venueId, Number(b.budgetAmount)])
  );

  const counts = countsRaw.map((row) => ({
    ...row,
    budgetAmount: budgetMap.get(row.venueId) ?? 0,
  }));

  return counts.filter((c) => c.total > 0);
}

// ─── Venue Budgets ───────────────────────────────────────────────────────────

const venueBudgetSelect = {
  id: true,
  venueId: true,
  budgetAmount: true,
  usedAmount: true,
  period: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  venue: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ProcurementVenueBudgetSelect;

export async function getVenueBudgetList(period?: string, page = 1, limit = 20) {
  "use cache";
  cacheTag("procurement-budgets");
  cacheLife("seconds");

  const where: Prisma.ProcurementVenueBudgetWhereInput = period
    ? { period }
    : {};

  const [rawItems, total] = await Promise.all([
    db.procurementVenueBudget.findMany({
      where,
      select: venueBudgetSelect,
      orderBy: [{ venue: { name: "asc" } }, { period: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.procurementVenueBudget.count({ where }),
  ]);

  // Dynamically compute usedAmount from actual procurement spending
  const spendingTotals = await Promise.all(
    rawItems.map((item) => {
      const dateRange = periodToDateRange(item.period);
      return db.procurementItem.aggregate({
        where: {
          venueId: item.venueId,
          tanggalPermintaan: dateRange,
          status: { in: ["APPROVED", "COMPLETED"] },
        },
        _sum: { pettyCash: true },
      });
    })
  );

  const items = rawItems.map((item, idx) => ({
    ...item,
    usedAmount: Number(spendingTotals[idx]._sum.pettyCash ?? 0),
  }));

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getVenueBudgetById(id: string) {
  "use cache";
  cacheTag("procurement-budgets");
  cacheLife("seconds");

  return db.procurementVenueBudget.findUnique({
    where: { id },
    select: venueBudgetSelect,
  });
}

// ─── Inferred Result Types ────────────────────────────────────────────────────

export type ProcurementListResult = Awaited<ReturnType<typeof getProcurementList>>;
export type ProcurementItem = ProcurementListResult["items"][number];
export type ProcurementSummaryResult = Awaited<ReturnType<typeof getProcurementSummary>>;
export type SummaryByVenueResult = Awaited<ReturnType<typeof getProcurementSummaryByVenue>>;
export type SummaryByVenueItem = SummaryByVenueResult[number];
export type AnnouncementListResult = Awaited<ReturnType<typeof getAnnouncementList>>;
export type AnnouncementItem = AnnouncementListResult["items"][number];
export type VenueBudgetListResult = Awaited<ReturnType<typeof getVenueBudgetList>>;
export type VenueBudgetItem = VenueBudgetListResult["items"][number];
