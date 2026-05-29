import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { LeadFilterInput } from "@/lib/validations/lead";

const leadSelect = {
  id: true,
  name: true,
  contactNumbers: true,
  email: true,
  eventDate: true,
  estimatedPax: true,
  budgetRange: true,
  notes: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  status: {
    select: { id: true, name: true, color: true, isFinal: true, isSystem: true },
  },
  venue: {
    select: { id: true, name: true },
  },
  package: {
    select: { id: true, packageName: true },
  },
  eventType: {
    select: { id: true, name: true, category: true },
  },
  sourceOfInformation: {
    select: { id: true, name: true },
  },
  createdBy: {
    select: { id: true, fullName: true, nickName: true },
  },
  assignedTo: {
    select: { id: true, fullName: true, nickName: true },
  },
  convertedToCustomer: {
    select: { id: true, name: true },
  },
  convertedToBooking: {
    select: { id: true },
  },
} satisfies Prisma.LeadSelect;

export async function getLeads(filter: LeadFilterInput) {
  "use cache";
  cacheTag("leads");
  cacheLife("seconds");

  const { search, statusId, venueId, assignedToId, page, pageSize } = filter;

  const where: Prisma.LeadWhereInput = {
    ...(search?.trim() && {
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ],
    }),
    ...(statusId && { statusId }),
    ...(venueId && { venueId }),
    ...(assignedToId && { assignedToId }),
  };

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      select: leadSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.lead.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLeadById(id: string) {
  "use cache";
  cacheTag("leads");
  cacheLife("seconds");

  return db.lead.findUnique({
    where: { id },
    select: leadSelect,
  });
}

export async function getLeadStatuses() {
  "use cache";
  cacheTag("lead-statuses");
  cacheLife("minutes");

  return db.leadStatus.findMany({
    select: {
      id: true,
      name: true,
      color: true,
      sortOrder: true,
      isDefault: true,
      isFinal: true,
      isSystem: true,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });
}

export type LeadsResult = Awaited<ReturnType<typeof getLeads>>;
export type LeadItem = LeadsResult["items"][number];
export type LeadStatusItem = Awaited<ReturnType<typeof getLeadStatuses>>[number];
