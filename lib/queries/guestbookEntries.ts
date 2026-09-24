import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { DataScope } from "@/types/user";
import type { Prisma, GuestInteractionType, GuestVisitStatus } from "@prisma/client";
import { isBitrixSourceName } from "@/lib/validations/guestbook";

export type GuestbookCategoryFilter = "WEDDINGS" | "MICE" | "no_package";

export interface GuestbookFilterOptions {
  search?: string;
  venueId?: string;
  hostId?: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
  category?: GuestbookCategoryFilter;
  interactionType?: GuestInteractionType;
  status?: GuestVisitStatus;
  sourceOfInformationId?: string;
  festivalId?: string;
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
    // Cocokkan pilihan langsung (eventCategory) ATAU kategori paket yang ke-link.
    // Pakai AND agar tidak bentrok dengan where.OR milik filter pencarian.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ eventCategory: filters.category }, { package: { category: filters.category } }] },
    ];
  } else if (filters.category === "no_package") {
    where.packageId = null;
  }

  if (filters.interactionType) where.interactionType = filters.interactionType;
  if (filters.status) where.visitStatus = filters.status;
  if (filters.sourceOfInformationId) where.sourceOfInformationId = filters.sourceOfInformationId;
  if (filters.festivalId) where.festivalId = filters.festivalId;

  return where;
}

export interface PaginatedGuestbookEntries {
  data: GuestbookEntryRow[];
  total: number;
  weddingCount: number;
  miceCount: number;
  overview: GuestbookOverview;
  page: number;
  pageSize: number;
}

export interface GuestbookOverviewBucket {
  key: string;
  label: string;
  count: number;
  /**
   * Berapa dari `count` yang datang lewat iklan (punya bitrixAdsUrl). Hanya
   * diisi untuk sumber Bitrix — sumber lain tidak mengenal konsep ads URL.
   */
  adsCount?: number;
}

export interface GuestbookOverview {
  /** Rencana Visit — semua entry yang tercatat. */
  total: number;
  /** Sudah Visit — kunjungan yang tuntas, ditandai lewat checkOutAt. */
  checkedOut: number;
  /** Tidak Jadi Visit — entry yang berakhir Lost. */
  lost: number;
  /** Online Meeting — pertemuan daring, bukan kunjungan ke venue. */
  onlineMeetings: number;
  byStatus: GuestbookOverviewBucket[];
  byCategory: GuestbookOverviewBucket[];
  bySource: GuestbookOverviewBucket[];
  byVenue: GuestbookOverviewBucket[];
  byHost: GuestbookOverviewBucket[];
  adsUrlBuckets: GuestbookOverviewBucket[];
  adsUrlOrganik: number;
}

const guestbookEntrySelect = {
  id: true,
  visitorName: true,
  companyName: true,
  eventCategory: true,
  email: true,
  phoneNumber: true,
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
  bitrixAdsUrl: true,
  visitStatus: true,
  proofFiles: true,
  commitVisitDate: true,
  commitPayDate: true,
  sourceOfInformationId: true,
  packageId: true,
  segmentId: true,
  festivalId: true,
  venueId: true,
  salesId: true,
  attendanceConfirmedAt: true,
  createdAt: true,
  host: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  sales: { select: { id: true, fullName: true } },
  attendanceConfirmedBy: { select: { id: true, fullName: true } },
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
  segment: { select: { id: true, name: true } },
  festival: { select: { id: true, name: true, description: true, backgroundImageKey: true } },
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

  const categoryCountWhere = (cat: "WEDDINGS" | "MICE"): Prisma.GuestbookEntryWhereInput => ({
    AND: [
      where,
      { OR: [{ eventCategory: cat }, { eventCategory: null, package: { category: cat } }] },
    ],
  });

  const buildBuckets = (
    rows: Array<{ key: string | null; count: number }>,
    labels: Map<string, string>,
    fallback: string,
  ): GuestbookOverviewBucket[] => rows
    .filter((row) => row.key !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((row) => ({ key: row.key as string, label: labels.get(row.key as string) ?? fallback, count: row.count }));

  const [statusGroups, categoryGroups, sourceGroups, venueGroups, hostGroups, adsUrlGroups, sourceAdsGroups, checkedOut, lost, onlineMeetings] = await Promise.all([
    db.guestbookEntry.groupBy({ by: ["visitStatus"], where, _count: { _all: true } }),
    db.guestbookEntry.groupBy({ by: ["eventCategory"], where, _count: { _all: true } }),
    db.guestbookEntry.groupBy({ by: ["sourceOfInformationId"], where, _count: { _all: true } }),
    db.guestbookEntry.groupBy({ by: ["venueId"], where, _count: { _all: true } }),
    db.guestbookEntry.groupBy({ by: ["hostId"], where, _count: { _all: true } }),
    db.guestbookEntry.groupBy({ by: ["bitrixAdsUrl"], where, _count: { _all: true } }),
    // Entry beriklan per sumber — dipakai menandai "Iklan (n)" di kartu Sumber
    // Data, supaya Bitrix organik dan Bitrix dari iklan bisa dibedakan.
    db.guestbookEntry.groupBy({
      by: ["sourceOfInformationId"],
      where: { ...where, bitrixAdsUrl: { not: null } },
      _count: { _all: true },
    }),
    db.guestbookEntry.count({ where: { ...where, checkOutAt: { not: null } } }),
    db.guestbookEntry.count({ where: { ...where, visitStatus: "lost" } }),
    db.guestbookEntry.count({ where: { ...where, interactionType: "online_meeting" } }),
  ]);

  const sourceIds = sourceGroups.flatMap((row) => row.sourceOfInformationId ? [row.sourceOfInformationId] : []);
  const venueIds = venueGroups.flatMap((row) => row.venueId ? [row.venueId] : []);
  const hostIds = hostGroups.flatMap((row) => row.hostId ? [row.hostId] : []);
  const [sources, venues, hosts] = await Promise.all([
    db.sourceOfInformation.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true } }),
    db.venue.findMany({ where: { id: { in: venueIds } }, select: { id: true, name: true } }),
    db.profile.findMany({ where: { id: { in: hostIds } }, select: { id: true, fullName: true } }),
  ]);

  const sourceLabels = new Map(sources.map((row) => [row.id, row.name]));
  const venueLabels = new Map(venues.map((row) => [row.id, row.name]));
  const hostLabels = new Map(hosts.map((row) => [row.id, row.fullName ?? "Tanpa nama"]));
  const sourceAdsCounts = new Map(
    sourceAdsGroups.flatMap((row) =>
      row.sourceOfInformationId ? [[row.sourceOfInformationId, row._count._all] as const] : [],
    ),
  );
  const overview: GuestbookOverview = {
    total: await db.guestbookEntry.count({ where }),
    checkedOut,
    lost,
    onlineMeetings,
    byStatus: buildBuckets(statusGroups.map((row) => ({ key: row.visitStatus, count: row._count._all })), new Map([
      ["cold", "Cold"], ["warm", "Warm"], ["hot", "Hot"], ["done_visit", "Done Visit"], ["to_be_discuss", "To Be Discuss"], ["deal", "Deal"], ["lost", "Lost"],
    ]), "Tanpa status"),
    byCategory: buildBuckets(categoryGroups.map((row) => ({ key: row.eventCategory, count: row._count._all })), new Map([["WEDDINGS", "Wedding"], ["MICE", "MICE"]]), "Tanpa kategori"),
    bySource: buildBuckets(sourceGroups.map((row) => ({ key: row.sourceOfInformationId, count: row._count._all })), sourceLabels, "Tanpa sumber")
      .map((bucket) => {
        const adsCount = sourceAdsCounts.get(bucket.key) ?? 0;
        return isBitrixSourceName(bucket.label) && adsCount > 0 ? { ...bucket, adsCount } : bucket;
      }),
    byVenue: buildBuckets(venueGroups.map((row) => ({ key: row.venueId, count: row._count._all })), venueLabels, "Tanpa venue"),
    byHost: buildBuckets(hostGroups.map((row) => ({ key: row.hostId, count: row._count._all })), hostLabels, "Tanpa PIC"),
    adsUrlBuckets: adsUrlGroups
      .filter((row) => !!row.bitrixAdsUrl)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 10)
      .map((row) => ({ key: row.bitrixAdsUrl as string, label: row.bitrixAdsUrl as string, count: row._count._all })),
    adsUrlOrganik: adsUrlGroups.find((row) => row.bitrixAdsUrl === null)?._count._all ?? 0,
  };

  const [data, total, weddingCount, miceCount] = await Promise.all([
    db.guestbookEntry.findMany({
      where,
      select: guestbookEntrySelect,
      orderBy: { checkInAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.guestbookEntry.count({ where }),
    db.guestbookEntry.count({ where: categoryCountWhere("WEDDINGS") }),
    db.guestbookEntry.count({ where: categoryCountWhere("MICE") }),
  ]);

  overview.byCategory = [
    { key: "WEDDINGS", label: "Wedding", count: weddingCount },
    { key: "MICE", label: "MICE", count: miceCount },
  ].filter((bucket) => bucket.count > 0);

  return { data, total, weddingCount, miceCount, overview, page, pageSize };
}

export type GuestbookEntryItem = GuestbookEntryRow;
