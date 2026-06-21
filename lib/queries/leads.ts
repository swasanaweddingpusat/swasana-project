import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/storage";
import type { Prisma } from "@prisma/client";
import type { LeadFilterInput } from "@/lib/validations/lead";
import type { DataScope } from "@/types/user";

/**
 * Resolve bookingFeeEvidenceUrl from a stored S3 key to a full public URL.
 * Consistent with how paymentEvidence is handled in booking queries/actions.
 */
function resolveLeadEvidenceUrl<T extends { bookingFeeEvidenceUrl: string | null }>(
  lead: T,
): T {
  return {
    ...lead,
    bookingFeeEvidenceUrl: lead.bookingFeeEvidenceUrl
      ? getPublicUrl(lead.bookingFeeEvidenceUrl)
      : null,
  };
}

const leadSelect = {
  id: true,
  name: true,
  contactNumbers: true,
  email: true,
  emailCpp: true,
  emailCpw: true,
  nikCpp: true,
  nikCpw: true,
  addressCpp: true,
  addressCpw: true,
  address: true,
  eventDate: true,
  eventDateAlt: true,
  time: true,
  estimatedPax: true,
  budgetRange: true,
  notes: true,
  category: true,
  weddingSession: true,
  bitrixId: true,
  instansi: true,
  isDateLocked: true,
  bookingFeeAmount: true,
  bookingFeeDate: true,
  bookingFeeEvidenceUrl: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  status: {
    select: { id: true, name: true, color: true, isFinal: true, isSystem: true },
  },
  venue: {
    select: { id: true, name: true },
  },
  venueSecondary: {
    select: { id: true, name: true },
  },
  package: {
    select: { id: true, packageName: true },
  },
  eventType: {
    select: { id: true, name: true, category: true, code: true },
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

/**
 * Resolve the set of profileIds the caller is allowed to see leads for,
 * based on their dataScope. Returns null if scope = "all" (no restriction).
 *
 * This intentionally does NOT use "use cache" — the result is identity-specific
 * and must not be shared across callers.
 */
async function resolveLeadScopeFilter(
  callerProfileId: string,
  dataScope: DataScope,
): Promise<Prisma.LeadWhereInput> {
  if (dataScope === "all") return {};
  if (dataScope === "own") return { assignedToId: callerProfileId };

  // dataScope === "group": find all groups where caller is a member
  const myGroups = await db.userGroupMember.findMany({
    where: { userId: callerProfileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return { assignedToId: callerProfileId };

  const groupIds = myGroups.map((g) => g.groupId);

  // Fetch all members + group leaders (defensive: covers legacy leaders who
  // weren't added as members before the group-leader-sync fix was deployed)
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

  return { assignedToId: { in: [...allowedIds] } };
}

export async function getLeads(
  filter: LeadFilterInput,
  caller?: { profileId: string; dataScope: DataScope },
) {
  // NOTE: "use cache" intentionally removed — this function may receive an
  // identity-scoped filter (callerProfileId + dataScope). Caching a per-user
  // result set without a per-user cache key would leak data across callers.
  // Callers that need caching should cache at a higher layer with identity in key.

  const { search, scope, statusId, venueId, eventTypeId, assignedToId, page, pageSize } = filter;

  // Scope filter: active = isFinal:false, deal = isFinal&&isSystem, lost = isFinal&&!isSystem
  let scopeWhere: Prisma.LeadWhereInput = {};
  if (scope === "active") {
    scopeWhere = { status: { isFinal: false } };
  } else if (scope === "deal") {
    scopeWhere = { status: { isFinal: true, isSystem: true } };
  } else if (scope === "lost") {
    scopeWhere = { status: { isFinal: true, isSystem: false } };
  }

  // Data-access scope filter (group/own/all) — enforced from server session, never from HTTP params
  const dataScopeFilter = caller
    ? await resolveLeadScopeFilter(caller.profileId, caller.dataScope)
    : {};

  const where: Prisma.LeadWhereInput = {
    ...scopeWhere,
    ...dataScopeFilter,
    ...(search?.trim() && {
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ],
    }),
    // statusId filter only applies in active scope (deal/lost scope already constrains by flag)
    ...(statusId && scope === "active" && { statusId }),
    ...(venueId && { venueId }),
    ...(eventTypeId && { eventTypeId }),
    // assignedToId from query param is an additional narrowing filter on top of dataScopeFilter
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
    items: items.map(resolveLeadEvidenceUrl),
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

  const lead = await db.lead.findUnique({
    where: { id },
    select: leadSelect,
  });
  if (!lead) return null;
  return resolveLeadEvidenceUrl(lead);
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
    take: 200,
  });
}

export type LeadsResult = Awaited<ReturnType<typeof getLeads>>;
export type LeadItem = LeadsResult["items"][number];
export type LeadStatusItem = Awaited<ReturnType<typeof getLeadStatuses>>[number];
