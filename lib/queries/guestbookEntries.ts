import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { DataScope } from "@/types/user";
import type { Prisma, GuestInteractionType } from "@prisma/client";

export type GuestbookCategoryFilter = "WEDDINGS" | "MICE" | "no_package";

export interface GuestbookFilterOptions {
  search?: string;
  venueId?: string;
  hostId?: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
  category?: GuestbookCategoryFilter;
  interactionType?: GuestInteractionType;
}

export interface GuestbookEntriesOptions extends GuestbookFilterOptions {
  page?: number;
  pageSize?: number;
}

/** Mirrors buildSearchFilter/buildDateFilter in lib/queries/bookings.ts — the
 *  established convention for server-side filtered list endpoints. */
export function buildGuestbookWhere(filters: GuestbookFilterOptions): Prisma.GuestbookEntryWhereInput {
  const where: Prisma.GuestbookEntryWhereInput = {};

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { visitorName: { contains: search, mode: "insensitive" } },
      { guestCode: { contains: search, mode: "insensitive" } },
      { host: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (filters.venueId) where.venueId = filters.venueId;
  if (filters.hostId) where.hostId = filters.hostId;

  if (filters.dateFrom || filters.dateTo) {
    where.checkInAt = {
      ...(filters.dateFrom && { gte: new Date(`${filters.dateFrom}T00:00:00`) }),
      ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59.999`) }),
    };
  }

  if (filters.category === "WEDDINGS" || filters.category === "MICE") {
    where.package = { category: filters.category };
  } else if (filters.category === "no_package") {
    where.packageId = null;
  }

  if (filters.interactionType) where.interactionType = filters.interactionType;

  return where;
}

export interface PaginatedGuestbookEntries {
  data: GuestbookEntryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const guestbookEntrySelect = {
  id: true,
  visitorName: true,
  email: true,
  phoneNumber: true,
  visitorPhoto: true,
  interactionType: true,
  onlineMedium: true,
  meetingUrl: true,
  meetingLocation: true,
  scheduledAt: true,
  checkInAt: true,
  checkOutAt: true,
  notes: true,
  guestCode: true,
  phoneNumberNorm: true,
  bitrixContactId: true,
  bitrixName: true,
  bitrixSourceInfo: true,
  visitStatus: true,
  proofFiles: true,
  commitVisitDate: true,
  commitPayDate: true,
  sourceOfInformationId: true,
  packageId: true,
  venueId: true,
  salesId: true,
  createdAt: true,
  host: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  sales: { select: { id: true, fullName: true } },
  venue: { select: { id: true, name: true } },
  sourceOfInformation: { select: { id: true, name: true } },
  package: {
    select: {
      id: true,
      packageName: true,
      pax: true,
      category: true,
      sellingPrice: true,
      margin: true,
      categoryPrices: { select: { basePrice: true } },
    },
  },
} satisfies Prisma.GuestbookEntrySelect;

type GuestbookEntryRow = Prisma.GuestbookEntryGetPayload<{ select: typeof guestbookEntrySelect }>;

export async function getGuestbookEntries(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  options?: GuestbookEntriesOptions
): Promise<PaginatedGuestbookEntries> {
  const scopeWhere = (await buildOwnerScopeWhere(profileId, dataScope, "salesId")) as Prisma.GuestbookEntryWhereInput;
  const where: Prisma.GuestbookEntryWhereInput = { ...scopeWhere, ...buildGuestbookWhere(options ?? {}) };

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 50));

  const [data, total] = await Promise.all([
    db.guestbookEntry.findMany({
      where,
      select: guestbookEntrySelect,
      orderBy: { checkInAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.guestbookEntry.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export type GuestbookEntryItem = GuestbookEntryRow;
