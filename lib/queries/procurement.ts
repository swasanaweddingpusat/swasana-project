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

  const { venueId, division, status, dateFrom, dateTo, page, limit } = filter;

  const where: Prisma.ProcurementItemWhereInput = {
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

// ─── Inferred Result Types ────────────────────────────────────────────────────

export type ProcurementListResult = Awaited<ReturnType<typeof getProcurementList>>;
export type ProcurementItem = ProcurementListResult["items"][number];
export type ProcurementSummaryResult = Awaited<ReturnType<typeof getProcurementSummary>>;
export type AnnouncementListResult = Awaited<ReturnType<typeof getAnnouncementList>>;
export type AnnouncementItem = AnnouncementListResult["items"][number];
