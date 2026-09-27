import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { DataScope } from "@/types/user";
import type { Prisma, GuestInteractionType, GuestVisitStatus } from "@prisma/client";
import { isBitrixSourceName } from "@/lib/validations/guestbook";

export type GuestbookCategoryFilter = "WEDDINGS" | "MICE" | "no_package";

export interface GuestbookFilterOptions {
  search?: string;
  venueIds?: string[];
  hostId?: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
  categories?: GuestbookCategoryFilter[];
  interactionTypes?: GuestInteractionType[];
  statuses?: GuestVisitStatus[];
  sourceOfInformationIds?: string[];
  festivalIds?: string[];
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

  if (filters.venueIds?.length) where.venueId = { in: filters.venueIds };
  if (filters.hostId) where.hostId = filters.hostId;

  if (filters.dateFrom || filters.dateTo) {
    where.checkInAt = {
      ...(filters.dateFrom && { gte: new Date(`${filters.dateFrom}T00:00:00`) }),
      ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59.999`) }),
    };
  }

  const eventCategories = (filters.categories ?? []).filter(
    (c): c is "WEDDINGS" | "MICE" => c === "WEDDINGS" || c === "MICE"
  );
  const wantsNoPackage = (filters.categories ?? []).includes("no_package");
  if (eventCategories.length > 0 || wantsNoPackage) {
    // Cocokkan pilihan langsung (eventCategory) ATAU kategori paket yang ke-link,
    // ATAU "belum ada paket". Pakai AND agar tidak bentrok dengan where.OR milik
    // filter pencarian.
    const categoryOr: Prisma.GuestbookEntryWhereInput[] = [];
    if (eventCategories.length > 0) {
      categoryOr.push({ OR: [{ eventCategory: { in: eventCategories } }, { package: { category: { in: eventCategories } } }] });
    }
    if (wantsNoPackage) {
      categoryOr.push({ packageId: null });
    }
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: categoryOr },
    ];
  }

  if (filters.interactionTypes?.length) where.interactionType = { in: filters.interactionTypes };
  if (filters.statuses?.length) where.visitStatus = { in: filters.statuses };
  if (filters.sourceOfInformationIds?.length) where.sourceOfInformationId = { in: filters.sourceOfInformationIds };
  if (filters.festivalIds?.length) where.festivalId = { in: filters.festivalIds };

  return where;
}

export interface PaginatedGuestbookEntries {
  data: GuestbookEntryItem[];
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
  rsvpToken: true,
  confirmedGuestCount: true,
  confirmedGuestCountAt: true,
  actualGuestCount: true,
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
  festival: {
    select: {
      id: true,
      name: true,
      description: true,
      backgroundImageKey: true,
      barcodeBoxX: true,
      barcodeBoxY: true,
      barcodeBoxWidth: true,
      barcodeBoxHeight: true,
    },
  },
} satisfies Prisma.GuestbookEntrySelect;

type GuestbookEntryRow = Prisma.GuestbookEntryGetPayload<{ select: typeof guestbookEntrySelect }>;

/** Candidate cap for the guest-grouping pass in getGuestbookEntries — mirrors the
 *  bounded take() used by app/api/guestbook/export/route.ts for bulk reads. */
const GUEST_GROUPING_CANDIDATE_CAP = 5000;

/** Guests are grouped by normalized phone + lowercased name (mirrors the matching
 *  rule previously used client-side in GuestbookClient/GuestbookDetailDrawer).
 *  Entries without a phoneNumberNorm can't be reliably matched to anyone else,
 *  so each is kept as its own singleton group keyed by its own id. */
function guestGroupKey(entry: { id: string; visitorName: string; phoneNumberNorm: string | null }): string {
  if (!entry.phoneNumberNorm) return `id:${entry.id}`;
  return `norm:${entry.phoneNumberNorm}|${entry.visitorName.trim().toLowerCase()}`;
}

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

  // Grouped pagination: one row per unique guest (same normalized phone + name),
  // shown across festivals/venues. Candidates are fetched lightweight & capped,
  // grouped in JS, then the current page's representatives are hydrated with the
  // full select. Overview stats and weddingCount/miceCount stay entry-level (not
  // guest-level) — they describe raw activity volume, not unique-guest counts.
  const [candidates, weddingCount, miceCount] = await Promise.all([
    db.guestbookEntry.findMany({
      where,
      select: { id: true, visitorName: true, phoneNumberNorm: true, checkInAt: true },
      orderBy: { checkInAt: "desc" },
      take: GUEST_GROUPING_CANDIDATE_CAP,
    }),
    db.guestbookEntry.count({ where: categoryCountWhere("WEDDINGS") }),
    db.guestbookEntry.count({ where: categoryCountWhere("MICE") }),
  ]);

  const groups = new Map<string, { representativeId: string; representativeCheckInAt: Date; visitCount: number }>();
  for (const candidate of candidates) {
    const key = guestGroupKey(candidate);
    const existing = groups.get(key);
    if (existing) {
      existing.visitCount += 1;
    } else {
      // candidates are ordered by checkInAt desc, so the first entry seen per
      // key is already the most recent visit — keep it as the representative.
      groups.set(key, {
        representativeId: candidate.id,
        representativeCheckInAt: candidate.checkInAt,
        visitCount: 1,
      });
    }
  }

  const groupedList = Array.from(groups.values()).sort(
    (a, b) => b.representativeCheckInAt.getTime() - a.representativeCheckInAt.getTime()
  );

  const total = groupedList.length;
  const pageGroups = groupedList.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  const visitCountByRepresentativeId = new Map(pageGroups.map((g) => [g.representativeId, g.visitCount]));
  const pageIds = pageGroups.map((g) => g.representativeId);

  const rows = pageIds.length > 0
    ? await db.guestbookEntry.findMany({ where: { id: { in: pageIds } }, select: guestbookEntrySelect })
    : [];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const data: GuestbookEntryItem[] = pageIds.flatMap((id) => {
    const row = rowById.get(id);
    if (!row) return [];
    return [{ ...row, visitHistoryCount: visitCountByRepresentativeId.get(id) ?? 1 }];
  });

  overview.byCategory = [
    { key: "WEDDINGS", label: "Wedding", count: weddingCount },
    { key: "MICE", label: "MICE", count: miceCount },
  ].filter((bucket) => bucket.count > 0);

  return { data, total, weddingCount, miceCount, overview, page, pageSize };
}

export type GuestbookEntryItem = GuestbookEntryRow & { visitHistoryCount: number };

export interface GuestVisitHistoryItem {
  id: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  visitStatus: GuestVisitStatus | null;
  guestCode: string | null;
  festival: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

/** Full cross-festival visit history for the guest behind `entryId` (matched by
 *  normalized phone + name, same rule as getGuestbookEntries' grouping) — used by
 *  the Detail drawer instead of only scanning the current page's fetched rows. */
export async function getGuestVisitHistory(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  entryId: string
): Promise<GuestVisitHistoryItem[]> {
  const scopeWhere = (await buildOwnerScopeWhere(profileId, dataScope, "salesId")) as Prisma.GuestbookEntryWhereInput;

  const anchor = await db.guestbookEntry.findFirst({
    where: { ...scopeWhere, id: entryId },
    select: { id: true, visitorName: true, phoneNumberNorm: true },
  });
  if (!anchor) return [];

  const matchWhere: Prisma.GuestbookEntryWhereInput = anchor.phoneNumberNorm
    ? {
        ...scopeWhere,
        phoneNumberNorm: anchor.phoneNumberNorm,
        visitorName: { equals: anchor.visitorName, mode: "insensitive" },
      }
    : { ...scopeWhere, id: anchor.id };

  return db.guestbookEntry.findMany({
    where: matchWhere,
    select: {
      id: true,
      checkInAt: true,
      checkOutAt: true,
      visitStatus: true,
      guestCode: true,
      festival: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });
}
