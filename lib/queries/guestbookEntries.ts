import { db } from "@/lib/db";
import { buildOwnerScopeWhere } from "@/lib/access-control";
import type { DataScope } from "@/types/user";
import type { Prisma } from "@prisma/client";
import { isBitrixSourceName } from "@/lib/validations/guestbook";
import { PROSPECT_STATUS } from "@/lib/prospect-status";

export type GuestbookCategoryFilter = "WEDDINGS" | "MICE" | "no_package";

export interface GuestbookFilterOptions {
  search?: string;
  venueIds?: string[];
  hostId?: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string; // yyyy-MM-dd
  categories?: GuestbookCategoryFilter[];
  /** ID ProspectStatus — menggantikan filter enum status + interaction type. */
  statusIds?: string[];
  sourceOfInformationIds?: string[];
  festivalIds?: string[];
  /** Kolom tanggal yang dipakai filter rentang. Default `checkInAt`.
   *  - `checkInAt` : tanggal kunjungan tamu (list & export).
   *  - `createdAt` : tanggal sales input data (seluruh metrik Overview). */
  dateField?: GuestbookDateField;
}

export type GuestbookDateField = "checkInAt" | "createdAt";

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
      { phoneNumber: { contains: search, mode: "insensitive" } },
      { host: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (filters.venueIds?.length) where.venueId = { in: filters.venueIds };
  if (filters.hostId) where.hostId = filters.hostId;

  if (filters.dateFrom || filters.dateTo) {
    where[filters.dateField ?? "checkInAt"] = {
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

  if (filters.statusIds?.length) where.prospectStatusId = { in: filters.statusIds };
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
  /** Database — semua entry guestbook yang tercatat. */
  total: number;
  /** Sudah Visit — entry berstatus "Visit Venue". */
  doneVisit: number;
  /** Tidak Jadi Visit — entry berstatus "Tidak Jadi Visit (Lost)". */
  lost: number;
  /** Online Meeting — entry berstatus "Online Meeting". */
  onlineMeetings: number;
  /** Deal — entry berstatus "Deal" saja, tanpa No Deal (Lost). */
  deal: number;
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
  onlineMedium: true,
  meetingUrl: true,
  meetingLocation: true,
  scheduledAt: true,
  checkInAt: true,
  notes: true,
  guestCode: true,
  phoneNumberNorm: true,
  bitrixContactId: true,
  bitrixName: true,
  bitrixSourceInfo: true,
  bitrixAdsUrl: true,
  prospectStatusId: true,
  prospectStatus: { select: { id: true, name: true, sortOrder: true } },
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

  const [statusGroups, categoryGroups, sourceGroups, venueGroups, hostGroups, adsUrlGroups, sourceAdsGroups, doneVisit, lost, onlineMeetings, deal] = await Promise.all([
    db.guestbookEntry.groupBy({ by: ["prospectStatusId"], where, _count: { _all: true } }),
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
    db.guestbookEntry.count({ where: { ...where, prospectStatus: { name: PROSPECT_STATUS.VISIT_VENUE } } }),
    db.guestbookEntry.count({ where: { ...where, prospectStatus: { name: PROSPECT_STATUS.TIDAK_JADI_VISIT_LOST } } }),
    db.guestbookEntry.count({ where: { ...where, prospectStatus: { name: PROSPECT_STATUS.ONLINE_MEETING } } }),
    db.guestbookEntry.count({ where: { ...where, prospectStatus: { name: PROSPECT_STATUS.DEAL } } }),
  ]);

  // Label status dibaca dari tabel — daftar status dikelola admin lewat
  // Settings, jadi tidak boleh di-hardcode seperti enum sebelumnya.
  const allProspectStatuses = await db.prospectStatus.findMany({ select: { id: true, name: true } });
  const statusLabels = new Map(allProspectStatuses.map((row) => [row.id, row.name]));

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
    doneVisit,
    lost,
    onlineMeetings,
    deal,
    // Semua status tetap ditampilkan walau belum pernah dipakai (count 0),
    // beda dengan bucket lain yang cuma menampilkan nilai yang benar-benar ada.
    byStatus: allProspectStatuses
      .map((status) => {
        const group = statusGroups.find((row) => row.prospectStatusId === status.id);
        return { key: status.id, label: status.name, count: group?._count._all ?? 0 };
      })
      .sort((a, b) => b.count - a.count),
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
  prospectStatus: { id: string; name: string } | null;
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
      prospectStatus: { select: { id: true, name: true } },
      guestCode: true,
      festival: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
    },
    orderBy: { checkInAt: "desc" },
    take: 50,
  });
}

export interface GuestbookFunnelReport {
  database: number;
  onlineMeeting: number;
  belumVisit: number;
  visitVenue: number;
  tidakJadiVisitLost: number;
  noDealLost: number;
  deal: number;
  databaseToVisitPct: number;
  databaseToDealPct: number;
}

/** Satu baris breakdown status untuk kartu "Database dari Ads". Semua status
 *  prospek ditampilkan sebagai pembagian dari total entry ber-Ads URL, jadi
 *  jumlah seluruh count == totalAdsUrl. `statusId: null` = entry ads yang belum
 *  punya status prospek. */
export interface GuestbookAdsStatusBucket {
  statusId: string | null;
  statusName: string;
  count: number;
}

export interface GuestbookFunnelReportResult {
  overall: GuestbookFunnelReport;
  /** Funnel yang datasetnya dibatasi ke entry ber-Bitrix Ads URL. Pembilang dan
   *  penyebut rasio Ads harus sama-sama dari sini, kalau tidak persentasenya
   *  bisa tembus 100% (mis. Visit Venue keseluruhan dibagi Total Ads URL). */
  ads: GuestbookFunnelReport;
  /** Jumlah entry pada filter aktif yang benar-benar memiliki Bitrix Ads URL. */
  totalAdsUrl: number;
  /** Breakdown SEMUA status untuk kartu "Database dari Ads" — dataset sama dengan
   *  `ads`/`totalAdsUrl`, sehingga jumlah seluruh count == totalAdsUrl. */
  adsStatusBreakdown: GuestbookAdsStatusBucket[];
}

/** Hitung jumlah entry per nama status dalam satu query, lalu baca nilainya
 *  lewat helper. Menggantikan kombinasi interactionType + visitStatus yang lama:
 *  sekarang tiap bucket funnel dipetakan langsung ke satu status prospek. */
async function countByStatusName(
  where: Prisma.GuestbookEntryWhereInput
): Promise<Map<string, number>> {
  const [groups, statuses] = await Promise.all([
    db.guestbookEntry.groupBy({ by: ["prospectStatusId"], where, _count: { _all: true } }),
    db.prospectStatus.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(statuses.map((row) => [row.id, row.name]));
  const result = new Map<string, number>();
  for (const row of groups) {
    const name = row.prospectStatusId ? nameById.get(row.prospectStatusId) : undefined;
    if (name) result.set(name, (result.get(name) ?? 0) + row._count._all);
  }
  return result;
}

/** Shared funnel bucket math. Baik Database maupun Ads Performance memakai
 *  Visit Venue sebagai titik visit. Ads hanya membatasi dataset ke entry yang
 *  memiliki bitrixAdsUrl, bukan mengubah definisi visit. */
async function computeFunnelReport(
  where: Prisma.GuestbookEntryWhereInput,
): Promise<GuestbookFunnelReport> {
  const [database, counts] = await Promise.all([
    db.guestbookEntry.count({ where }),
    countByStatusName(where),
  ]);
  const at = (name: string) => counts.get(name) ?? 0;

  const rawOnlineMeeting = at(PROSPECT_STATUS.ONLINE_MEETING);
  const rawVisitVenue = at(PROSPECT_STATUS.VISIT_VENUE);
  const tidakJadiVisitLost = at(PROSPECT_STATUS.TIDAK_JADI_VISIT_LOST);
  const noDealLost = at(PROSPECT_STATUS.NO_DEAL_LOST);
  const deal = at(PROSPECT_STATUS.DEAL);

  // Setiap status dihitung apa adanya karena ProspectStatus sekarang satu field
  // eksklusif: Visit Venue tidak boleh ditambah Deal. Belum Visit menjadi sisa
  // setelah seluruh status funnel eksplisit dikurangkan dari Database.
  const onlineMeeting = rawOnlineMeeting;
  const visitVenue = rawVisitVenue;
  const belumVisit = Math.max(
    0,
    database - onlineMeeting - visitVenue - tidakJadiVisitLost - noDealLost - deal,
  );
  const visitCount = visitVenue;

  return {
    database,
    onlineMeeting,
    belumVisit,
    visitVenue,
    tidakJadiVisitLost,
    noDealLost,
    deal,
    databaseToVisitPct: database > 0 ? (visitCount / database) * 100 : 0,
    databaseToDealPct: database > 0 ? (deal / database) * 100 : 0,
  };
}

/** Breakdown per-status untuk kartu "Database dari Ads". Menampilkan SEMUA
 *  status prospek (ikut sortOrder Settings) supaya layout stabil walau sebuah
 *  status bernilai 0, lalu menambah bucket "Belum ada status" untuk entry ads
 *  tanpa status. Totalnya == jumlah entry ber-Ads URL. */
async function computeAdsStatusBreakdown(
  where: Prisma.GuestbookEntryWhereInput
): Promise<GuestbookAdsStatusBucket[]> {
  const [groups, statuses] = await Promise.all([
    db.guestbookEntry.groupBy({ by: ["prospectStatusId"], where, _count: { _all: true } }),
    db.prospectStatus.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const countById = new Map<string | null, number>();
  for (const row of groups) countById.set(row.prospectStatusId, row._count._all);

  const buckets: GuestbookAdsStatusBucket[] = statuses.map((status) => ({
    statusId: status.id,
    statusName: status.name,
    count: countById.get(status.id) ?? 0,
  }));

  const noStatusCount = countById.get(null) ?? 0;
  if (noStatusCount > 0) {
    buckets.push({ statusId: null, statusName: "Belum ada status", count: noStatusCount });
  }
  return buckets;
}

export type GuestbookFunnelBucketKey =
  | "database"
  | "onlineMeeting"
  | "belumVisit"
  | "visitVenue"
  | "tidakJadiVisitLost"
  | "deal"
  | "noDealLost"
  | "cold"
  | "warm"
  | "hot"
  | "noResponse"
  | "totalAds";

/** Kunci drill-down untuk drawer. Selain bucket funnel tetap, kartu "Database
 *  dari Ads" memakai `adsStatus:<statusId>` (atau `adsStatus:none` untuk entry
 *  ads tanpa status) agar drawer-nya dibatasi ke dataset ads, bukan keseluruhan. */
export type GuestbookFunnelDrilldownKey = GuestbookFunnelBucketKey | `adsStatus:${string}`;

export interface GuestbookFunnelBucketEntry {
  id: string;
  visitorName: string;
  companyName: string | null;
  phoneNumber: string | null;
  checkInAt: Date;
  prospectStatus: { id: string; name: string } | null;
  host: { id: string; fullName: string | null } | null;
  venue: { id: string; name: string } | null;
  sourceOfInformation: { id: string; name: string } | null;
  bitrixAdsUrl: string | null;
}

const FUNNEL_BUCKET_TAKE = 200;

/** Status yang dikurangkan dari Database untuk mendapat sisa Belum Visit —
 *  harus persis sama dengan yang dipakai di computeFunnelReport supaya angka
 *  card dan isi drawer selalu konsisten. */
const BELUM_VISIT_EXCLUDED_STATUSES = [
  PROSPECT_STATUS.ONLINE_MEETING,
  PROSPECT_STATUS.VISIT_VENUE,
  PROSPECT_STATUS.TIDAK_JADI_VISIT_LOST,
  PROSPECT_STATUS.NO_DEAL_LOST,
  PROSPECT_STATUS.DEAL,
];

const FUNNEL_BUCKET_STATUS_NAME: Partial<Record<GuestbookFunnelBucketKey, string>> = {
  onlineMeeting: PROSPECT_STATUS.ONLINE_MEETING,
  visitVenue: PROSPECT_STATUS.VISIT_VENUE,
  tidakJadiVisitLost: PROSPECT_STATUS.TIDAK_JADI_VISIT_LOST,
  deal: PROSPECT_STATUS.DEAL,
  noDealLost: PROSPECT_STATUS.NO_DEAL_LOST,
  cold: PROSPECT_STATUS.COLD,
  warm: PROSPECT_STATUS.WARM,
  hot: PROSPECT_STATUS.HOT,
  noResponse: PROSPECT_STATUS.NO_RESPONSE,
};

/** Daftar entry mentah di balik satu bucket funnel/ads Overview — dipakai drawer
 *  saat sebuah stat card di-klik. Logika pencocokan bucket sengaja dijaga persis
 *  sama dengan computeFunnelReport/computeAdsStatusBreakdown di atas. */
export async function getGuestbookFunnelBucketEntries(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  filters: GuestbookFilterOptions | undefined,
  bucket: GuestbookFunnelDrilldownKey
): Promise<GuestbookFunnelBucketEntry[]> {
  const scopeWhere = (await buildOwnerScopeWhere(profileId, dataScope, "salesId")) as Prisma.GuestbookEntryWhereInput;
  const baseWhere: Prisma.GuestbookEntryWhereInput = { ...scopeWhere, ...buildGuestbookWhere(filters ?? {}) };

  let where: Prisma.GuestbookEntryWhereInput;
  if (bucket === "database") {
    where = baseWhere;
  } else if (bucket === "totalAds") {
    where = { AND: [baseWhere, { bitrixAdsUrl: { not: null } }, { bitrixAdsUrl: { not: "" } }] };
  } else if (bucket.startsWith("adsStatus:")) {
    // Kartu "Database dari Ads": drill-down dibatasi ke entry ber-Ads URL agar
    // konsisten dengan angka breakdown, bukan seluruh dataset.
    const statusId = bucket.slice("adsStatus:".length);
    where = {
      AND: [
        baseWhere,
        { bitrixAdsUrl: { not: null } },
        { bitrixAdsUrl: { not: "" } },
        statusId === "none" ? { prospectStatusId: null } : { prospectStatusId: statusId },
      ],
    };
  } else if (bucket === "belumVisit") {
    where = {
      AND: [
        baseWhere,
        { OR: [{ prospectStatusId: null }, { prospectStatus: { name: { notIn: BELUM_VISIT_EXCLUDED_STATUSES } } }] },
      ],
    };
  } else {
    where = { ...baseWhere, prospectStatus: { name: FUNNEL_BUCKET_STATUS_NAME[bucket as GuestbookFunnelBucketKey] } };
  }

  return db.guestbookEntry.findMany({
    where,
    select: {
      id: true,
      visitorName: true,
      companyName: true,
      phoneNumber: true,
      checkInAt: true,
      prospectStatus: { select: { id: true, name: true } },
      host: { select: { id: true, fullName: true } },
      venue: { select: { id: true, name: true } },
      sourceOfInformation: { select: { id: true, name: true } },
      bitrixAdsUrl: true,
    },
    orderBy: { checkInAt: "desc" },
    take: FUNNEL_BUCKET_TAKE,
  });
}

/** Powers Guestbook Overview performance cards.
 *
 *  Rentang tanggal memakai `createdAt` (tanggal sales input data), BUKAN
 *  `checkInAt`. Matriks ini mengukur produktivitas input sales pada periode
 *  terpilih, jadi harus dikunci ke kolom yang sama dengan kartu ringkasan
 *  Overview — kalau beda, Database di matriks dan di kartu tidak akan cocok.
 *
 *  `ads` adalah funnel terpisah yang dibatasi ke entry ber-`bitrixAdsUrl`;
 *  `totalAdsUrl` dipakai sebagai denominator rasio Ads Performance. */
export async function getGuestbookFunnelReport(
  profileId: string | undefined,
  dataScope: DataScope | undefined,
  filters?: GuestbookFilterOptions
): Promise<GuestbookFunnelReportResult> {
  const scopeWhere = (await buildOwnerScopeWhere(profileId, dataScope, "salesId")) as Prisma.GuestbookEntryWhereInput;
  const where: Prisma.GuestbookEntryWhereInput = {
    ...scopeWhere,
    ...buildGuestbookWhere({ ...(filters ?? {}), dateField: "createdAt" }),
  };
  // Total Ads URL hanya menghitung entry yang benar-benar punya URL iklan.
  // `not: null` saja masih menerima string kosong dari data legacy.
  const adsWhere: Prisma.GuestbookEntryWhereInput = {
    AND: [where, { bitrixAdsUrl: { not: null } }, { bitrixAdsUrl: { not: "" } }],
  };

  const [overall, ads, totalAdsUrl, adsStatusBreakdown] = await Promise.all([
    computeFunnelReport(where),
    computeFunnelReport(adsWhere),
    db.guestbookEntry.count({ where: adsWhere }),
    computeAdsStatusBreakdown(adsWhere),
  ]);

  return { overall, ads, totalAdsUrl, adsStatusBreakdown };
}
