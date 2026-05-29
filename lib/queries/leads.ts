import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { LeadFilterInput } from "@/lib/validations/lead";

const leadSelect = {
  id: true,
  name: true,
  contactNumbers: true,
  email: true,
  category: true,
  eventDate: true,
  estimatedPax: true,
  budgetRange: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  status: {
    select: { id: true, name: true, color: true },
  },
  venue: {
    select: { id: true, name: true },
  },
  package: {
    select: { id: true, packageName: true },
  },
  eventType: {
    select: { id: true, name: true },
  },
  sourceOfInformation: {
    select: { id: true, name: true },
  },
  createdBy: {
    select: { id: true, fullName: true, nickName: true },
  },
} satisfies Prisma.LeadSelect;

export async function getLeads(filter: LeadFilterInput) {
  "use cache";
  cacheTag("leads");
  cacheLife("seconds");

  const { search, category, statusId, venueId, page, pageSize } = filter;

  const where: Prisma.LeadWhereInput = {
    ...(search?.trim() && {
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ],
    }),
    ...(category && category !== "all" && { category }),
    ...(statusId && { statusId }),
    ...(venueId && { venueId }),
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

export async function getLeadStatuses(category?: "WEDDINGS" | "MICE") {
  "use cache";
  cacheTag("lead-statuses");
  cacheLife("minutes");

  return db.leadStatus.findMany({
    where: category ? { category } : undefined,
    select: {
      id: true,
      name: true,
      color: true,
      category: true,
      sortOrder: true,
      isPipeline: true,
      isDefault: true,
      isSystem: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
}

export type LeadsResult = Awaited<ReturnType<typeof getLeads>>;
export type LeadItem = LeadsResult["items"][number];
export type LeadStatusItem = Awaited<ReturnType<typeof getLeadStatuses>>[number];
