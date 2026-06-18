import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { MaintenanceFilterInput } from "@/lib/validations/maintenance";
import { resolveAvatarUrl } from "@/lib/storage";

const ticketSelect = {
  id: true,
  type: true,
  description: true,
  estimateDate: true,
  isVendor: true,
  isAudit: true,
  frequency: true,
  nextDueDate: true,
  createdAt: true,
  updatedAt: true,
  venue: { select: { id: true, name: true, brand: { select: { id: true, name: true } } } },
  category: { select: { id: true, name: true } },
  priority: { select: { id: true, name: true, deadlineDays: true } },
  status: { select: { id: true, name: true, order: true } },
  assignedTo: { select: { id: true, fullName: true, nickName: true } },
  createdBy: { select: { id: true, fullName: true, nickName: true } },
  images: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.MaintenanceTicketSelect;

export async function getMaintenanceTickets(filter: MaintenanceFilterInput) {
  "use cache";
  cacheTag("maintenance");
  cacheLife("seconds");

  const {
    type, search, venueId, brandId, statusId, priorityId,
    categoryId, assignedToId, roleId, isVendor, isAudit,
    dateFrom, dateTo, page, pageSize,
  } = filter;

  const where: Prisma.MaintenanceTicketWhereInput = {
    ...(type && { type }),
    ...(search?.trim() && {
      OR: [
        { description: { contains: search.trim(), mode: "insensitive" } },
        { category: { name: { contains: search.trim(), mode: "insensitive" } } },
      ],
    }),
    ...(venueId && { venueId }),
    ...(brandId && { venue: { brandId } }),
    ...(statusId && { statusId }),
    ...(priorityId && { priorityId }),
    ...(categoryId && { categoryId }),
    ...(assignedToId && { assignedToId }),
    ...(roleId && { assignedTo: { roleId } }),
    ...(isVendor === "true" && { isVendor: true }),
    ...(isAudit === "true" && { isAudit: true }),
    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    }),
  };

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.maintenanceTicket.findMany({
      where,
      select: ticketSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.maintenanceTicket.count({ where }),
  ]);

  const resolvedItems = items.map((t) => ({
    ...t,
    images: t.images.map((img) => ({ ...img, url: resolveAvatarUrl(img.url) ?? img.url })),
  }));

  return {
    items: resolvedItems,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getMaintenanceTicketById(id: string) {
  "use cache";
  cacheTag("maintenance");
  cacheLife("seconds");

  const t = await db.maintenanceTicket.findUnique({
    where: { id },
    select: ticketSelect,
  });

  if (!t) return null;

  return {
    ...t,
    images: t.images.map((img) => ({ ...img, url: resolveAvatarUrl(img.url) ?? img.url })),
  };
}

export async function getMaintenanceReport(filter: {
  venueId?: string;
  brandId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  "use cache";
  cacheTag("maintenance");
  cacheLife("seconds");

  const where: Prisma.MaintenanceTicketWhereInput = {
    type: "TICKET",
    ...(filter.venueId && { venueId: filter.venueId }),
    ...(filter.brandId && { venue: { brandId: filter.brandId } }),
    ...((filter.dateFrom || filter.dateTo) && {
      createdAt: {
        ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
        ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
      },
    }),
  };

  const [total, byStatus, byCategory, byVenue] = await Promise.all([
    db.maintenanceTicket.count({ where }),
    db.maintenanceTicket.groupBy({ by: ["statusId"], where, _count: true }),
    db.maintenanceTicket.groupBy({ by: ["categoryId"], where, _count: true }),
    db.maintenanceTicket.groupBy({ by: ["venueId"], where, _count: true }),
  ]);

  const [statuses, categories, venues] = await Promise.all([
    db.maintenanceStatus.findMany({ select: { id: true, name: true }, take: 100 }),
    db.maintenanceCategory.findMany({ select: { id: true, name: true }, take: 100 }),
    db.venue.findMany({ select: { id: true, name: true }, take: 100 }),
  ]);

  const statusMap = new Map(statuses.map((s) => [s.id, s.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const venueMap = new Map(venues.map((v) => [v.id, v.name]));

  return {
    total,
    byStatus: byStatus.map((s) => ({ name: statusMap.get(s.statusId) ?? s.statusId, count: s._count })),
    byCategory: byCategory.map((c) => ({ name: categoryMap.get(c.categoryId) ?? c.categoryId, count: c._count })),
    byVenue: byVenue.map((v) => ({ name: venueMap.get(v.venueId) ?? v.venueId, count: v._count })),
  };
}

export async function getMaintenanceCategories() {
  "use cache";
  cacheTag("maintenance-categories");
  cacheLife("minutes");

  return db.maintenanceCategory.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: "asc" },
    take: 200,
  });
}

export async function getMaintenancePriorities() {
  "use cache";
  cacheTag("maintenance-priorities");
  cacheLife("minutes");

  return db.maintenancePriority.findMany({
    select: { id: true, name: true, deadlineDays: true, createdAt: true },
    orderBy: { deadlineDays: "desc" },
    take: 200,
  });
}

export async function getMaintenanceStatuses() {
  "use cache";
  cacheTag("maintenance-statuses");
  cacheLife("minutes");

  return db.maintenanceStatus.findMany({
    select: { id: true, name: true, order: true, createdAt: true },
    orderBy: { order: "asc" },
    take: 200,
  });
}

export type MaintenanceTicketsResult = Awaited<ReturnType<typeof getMaintenanceTickets>>;
export type MaintenanceTicketItem = MaintenanceTicketsResult["items"][number];
export type MaintenanceReportResult = Awaited<ReturnType<typeof getMaintenanceReport>>;
export type MaintenanceCategoryItem = Awaited<ReturnType<typeof getMaintenanceCategories>>[number];
export type MaintenancePriorityItem = Awaited<ReturnType<typeof getMaintenancePriorities>>[number];
export type MaintenanceStatusItem = Awaited<ReturnType<typeof getMaintenanceStatuses>>[number];
