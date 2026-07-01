import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

const bookingListInclude = {
  snapCustomer: { select: { name: true, mobileNumber: true } },
  // Drafts have no snapshot yet — fall back to the live customer for display.
  customer: { select: { name: true, mobileNumber: true } },
  snapVenue: { select: { venueName: true, brandCode: true } },
  snapPackage: { select: { packageName: true } },
  snapPackagePricing: { select: { packageName: true, pax: true, price: true, fullPrice: true, margin: true, termAndCondition: true } },
  sales: { select: { id: true, fullName: true } },
  manager: { select: { id: true, fullName: true } },
  paymentMethod: { select: { bankName: true } },
  sourceOfInformation: { select: { name: true } },
  clientAgreement: { select: { token: true, accessCode: true, status: true, expiresAt: true } },
  // List rows only need the TOP base fields (table computes paid/total + edit drawer
  // hydrates from these). The nested partialPayments are NOT consumed from list items
  // (the edit-finance drawer fetches them via useBookingFinanceDetail), so they're
  // dropped here to keep the list payload small. snapPackageCategoryPrices likewise is
  // only read from BookingDetail — kept on bookingDetailInclude below, not the list.
  termOfPayments: { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, amount: true, dueDate: true, sortOrder: true, paymentStatus: true, ackStatus: true, paymentEvidence: true, notes: true } },
  editDraft: { select: { id: true, editorProfileId: true, formState: true, pendingUploads: true, updatedAt: true } },
} as const;

const bookingDetailInclude = {
  ...bookingListInclude,
  snapCustomer: true,
  customer: { select: { bitrixId: true, cppNik: true, cpwNik: true, cppAddress: true, cpwAddress: true } },
  snapVenue: true,
  snapPackage: true,
  // Re-added here (dropped from bookingListInclude for payload size): the detail
  // view's SetHargaBookingDrawer / edit-booking-drawer read snapPackageCategoryPrices.
  snapPackageCategoryPrices: {
    select: {
      id: true,
      categoryName: true,
      basePrice: true,
      sortOrder: true,
      isShow: true,
      isTakeout: true,
      takeoutNominal: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
  snapPackagePricing: {
    select: {
      id: true,
      bookingId: true,
      packageId: true,
      packageName: true,
      pax: true,
      price: true,
      fullPrice: true,
      margin: true,
      termAndCondition: true,
      createdAt: true,
    },
  },
  venue: { select: { id: true } },
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapBonuses: { include: { orderStatus: { select: { id: true, name: true } } } },
  snapComplimentaries: { orderBy: { sortOrder: "asc" as const } },
  snapVendorItems: true,
  termOfPayments: { orderBy: { sortOrder: "asc" as const } },
  bookingDocuments: { orderBy: { createdAt: "desc" as const } },
  bookingRefunds: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true, type: true, amount: true, status: true,
      notes: true, settledAt: true, createdAt: true,
      bookingId: true,
      paymentMethodId: true,
      targetBookingId: true,
      snapVendorItemId: true,
      paymentMethod: { select: { bankName: true, bankAccountNumber: true, bankRecipient: true } },
      targetBooking: { select: { id: true, snapCustomer: { select: { name: true } } } },
    },
  },
  paymentMethod: true,
  sourceOfInformation: true,
  clientAgreement: true,
  // editDraft (formState + pendingUploads — large JSON) is inherited via the spread
  // above for the draft badge in the LIST. The detail view never reads it (the edit
  // drawer hydrates editDraft from the list row, not from BookingDetail), so drop it
  // here to keep the detail payload small.
  editDraft: false,
} as const;

import type { DataScope } from "@/types/user";
import type { Prisma, BookingStatus } from "@prisma/client";

// Minimal select for the page-scoped approval fetch (Fix #1). ApprovalRecord is
// polymorphic (linked to a booking via module + entityId, no FK) so Prisma cannot
// `include` it on the booking query. We fetch only the ~10 records for the active
// page and attach them per row. decidedBy / createdBy are intentionally omitted —
// the bookings table never reads them.
const bookingApprovalSelect = {
  id: true,
  entityId: true,
  status: true,
  steps: {
    orderBy: { stepOrder: "asc" as const },
    select: {
      id: true,
      stepOrder: true,
      approverType: true,
      approverRoleId: true,
      approverUserId: true,
      status: true,
      signature: true,
      decidedAt: true,
      notes: true,
      revisionId: true,
      approverRole: { select: { id: true, name: true } },
      approverUser: { select: { id: true, fullName: true } },
    },
  },
} as const;

export type BookingApproval = Awaited<
  ReturnType<typeof db.approvalRecord.findMany<{ select: typeof bookingApprovalSelect }>>
>[number];

type BookingListRow = Awaited<
  ReturnType<typeof db.booking.findMany<{ include: typeof bookingListInclude }>>
>[number];

export interface PaginatedBookings {
  data: (BookingListRow & { bookingApprovals: BookingApproval | null })[];
  total: number;
}

// NOTE: PO sort is now done natively by the DB via the poYear/poSeq columns
// (see getBookings orderBy). The former in-app parsePoSortKey/comparePoDesc helpers
// were removed — they only existed because the sort key lived inside the poNumber
// string, which is no longer the case.

export async function getBookings(
  profileId?: string,
  dataScope?: DataScope,
  options?: { page?: number; pageSize?: number; search?: string; venueId?: string; category?: "WEDDINGS" | "MICE"; recordStatus?: "saved" | "draft" | "all"; dateFrom?: string; dateTo?: string; year?: number; salesId?: string; approvalStatus?: "pending" | "approved" },
): Promise<PaginatedBookings> {
  const scopeFilter = await buildScopeFilter(profileId, dataScope);
  const searchFilter = buildSearchFilter(options?.search);
  const venueFilter: Prisma.BookingWhereInput = options?.venueId ? { venueId: options.venueId } : {};
  const categoryFilter: Prisma.BookingWhereInput = options?.category ? { category: options.category } : {};
  const rs = options?.recordStatus;
  const recordStatusFilter: Prisma.BookingWhereInput =
    rs === "draft" ? { recordStatus: "draft" } :
    rs === "all" ? {} :
    { recordStatus: "saved" };
  const dateFilter = buildDateFilter(options?.dateFrom, options?.dateTo, options?.year);
  const salesIdFilter: Prisma.BookingWhereInput = options?.salesId ? { salesId: options.salesId } : {};
  let approvalStatusFilter: Prisma.BookingWhereInput = {};
  if (options?.approvalStatus) {
    const approvedRecords = await db.approvalRecord.findMany({
      where: { module: "booking", status: "approved" },
      select: { entityId: true },
    });
    const approvedIds = approvedRecords.map((r) => r.entityId);
    approvalStatusFilter =
      options.approvalStatus === "approved"
        ? { id: { in: approvedIds } }
        : { id: { notIn: approvedIds } };
  }
  const where: Prisma.BookingWhereInput = { ...recordStatusFilter, ...scopeFilter, ...searchFilter, ...venueFilter, ...categoryFilter, ...dateFilter, ...salesIdFilter, ...approvalStatusFilter };

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 10));

  // Native PO order (year DESC, sequence DESC; drafts/null last), paginated by the DB.
  // poYear/poSeq are stored columns backed by @@index([recordStatus, poYear, poSeq]),
  // so the database does the sort + LIMIT/OFFSET — no more fetching up to 5000 keys and
  // sorting them in-app. This keeps the list query O(page) regardless of table size.
  // `createdAt` is the final tiebreaker (matches the old comparePoDesc behaviour).
  const orderBy: Prisma.BookingOrderByWithRelationInput[] = [
    { poYear: { sort: "desc", nulls: "last" } },
    { poSeq: { sort: "desc", nulls: "last" } },
    { createdAt: "desc" },
  ];

  const total = await db.booking.count({ where });

  const rows = await db.booking.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    // Single LATERAL JOIN for the page's ~11 included relations instead of a
    // round-trip per relation (Neon HTTP). One query for the whole page.
    relationLoadStrategy: "join",
    include: bookingListInclude,
  });

  const pageIds = rows.map((r) => r.id);

  // Page-scoped approval fetch: only the active page's bookings, replacing the old
  // client-side /api/approval-records call that pulled ALL booking records.
  const approvals = pageIds.length > 0
    ? await db.approvalRecord.findMany({
        where: { module: "booking", entityId: { in: pageIds } },
        select: bookingApprovalSelect,
      })
    : [] as BookingApproval[];
  const approvalByEntityId = new Map(approvals.map((a) => [a.entityId, a]));

  // rows already come back in the correct order from the DB — just attach approvals.
  const data = rows.map((r) => ({ ...r, bookingApprovals: approvalByEntityId.get(r.id) ?? null }));

  return { data, total };
}

function buildSearchFilter(search?: string): Prisma.BookingWhereInput {
  if (!search?.trim()) return {};
  const q = search.trim();
  return {
    OR: [
      { snapCustomer: { name: { contains: q, mode: "insensitive" } } },
      { snapCustomer: { mobileNumber: { contains: q, mode: "insensitive" } } },
      { snapVenue: { venueName: { contains: q, mode: "insensitive" } } },
      { snapPackage: { packageName: { contains: q, mode: "insensitive" } } },
      { sales: { fullName: { contains: q, mode: "insensitive" } } },
      { poNumber: { contains: q, mode: "insensitive" } },
      { paymentMethod: { bankName: { contains: q, mode: "insensitive" } } },
      { sourceOfInformation: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

function buildDateFilter(dateFrom?: string, dateTo?: string, year?: number): Prisma.BookingWhereInput {
  // Explicit date range wins — most specific filter
  if (dateFrom || dateTo) {
    const gte = dateFrom ? new Date(dateFrom) : undefined;
    const lte = dateTo ? new Date(dateTo) : undefined;
    if (gte && lte) return { eventDate: { gte, lte } };
    if (gte) return { eventDate: { gte } };
    return { eventDate: { lte: lte! } };
  }

  // Year filter — convenience shortcut for full calendar year
  if (year) {
    return {
      eventDate: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    };
  }

  // No filter
  return {};
}

async function buildScopeFilter(profileId?: string, dataScope?: DataScope) {
  if (!profileId || !dataScope || dataScope === "all") return {};
  if (dataScope === "own") return { salesId: profileId };

  // group: find all groups where profileId is a member
  const myGroups = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (myGroups.length === 0) return { salesId: profileId };
  const groupIds = myGroups.map((g) => g.groupId);

  // Fetch all members + group leaders (defensive: covers legacy leaders who
  // weren't added as members before this fix was deployed)
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

  const memberIds = new Set(members.map((m) => m.userId));
  for (const g of groupLeaders) {
    if (g.leaderId) memberIds.add(g.leaderId);
  }

  return { salesId: { in: [...memberIds] } };
}

export async function getBookingById(id: string) {
  const [booking, approvalRecord] = await Promise.all([
    db.booking.findUnique({
      where: { id },
      // Single LATERAL JOIN instead of one round-trip per relation. This detail
      // include pulls ~20 relations — over the Neon HTTP adapter the default
      // "query" strategy meant ~20 sequential network hops (the 4-5s we saw).
      relationLoadStrategy: "join",
      include: bookingDetailInclude,
    }),
    db.approvalRecord.findFirst({
      where: { module: "booking", entityId: id },
      include: {
        steps: {
          where: { approverType: "client" },
          select: { signature: true, status: true, decidedAt: true },
        },
      },
    }),
  ]);

  if (!booking) return null;

  const clientSignature = approvalRecord?.steps[0]?.signature ?? null;

  return { ...booking, clientSignature };
}

export type BookingsResult = PaginatedBookings;
export type BookingListItem = BookingsResult["data"][number];
export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingById>>>;

export async function getSalesProfiles() {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: { status: "active", role: { name: "sales" } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type SalesProfile = Awaited<ReturnType<typeof getSalesProfiles>>[number];

// ─── MICE Queries ─────────────────────────────────────────────────────────────

const miceListInclude = {
  customer: { select: { id: true, name: true, mobileNumber: true } },
  venue: { select: { id: true, name: true } },
  sales: { select: { id: true, fullName: true } },
  sourceOfInformation: { select: { id: true, name: true } },
  termOfPayments: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, name: true, amount: true, dueDate: true, paymentStatus: true },
  },
} as const;

export interface PaginatedMiceBookings {
  data: Awaited<ReturnType<typeof db.booking.findMany<{ include: typeof miceListInclude }>>>;
  total: number;
}

export async function getMiceBookings(
  options?: { page?: number; pageSize?: number; search?: string; status?: string },
): Promise<PaginatedMiceBookings> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 10));
  const q = options?.search?.trim();
  const where: Prisma.BookingWhereInput = {
    category: "MICE",
    recordStatus: "saved",
    ...(options?.status && options.status !== "all"
      ? { bookingStatus: options.status as BookingStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { venue: { name: { contains: q, mode: "insensitive" } } },
            { sales: { fullName: { contains: q, mode: "insensitive" } } },
            { poNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: miceListInclude,
    }),
    db.booking.count({ where }),
  ]);

  return { data, total };
}

export type MiceBookingsResult = PaginatedMiceBookings;
export type MiceBookingRow = MiceBookingsResult["data"][number];

export async function getMiceBookingById(id: string) {
  return db.booking.findFirst({
    where: { id, category: "MICE", recordStatus: "saved" },
    include: {
      customer: true,
      venue: { select: { id: true, name: true } },
      sales: { select: { id: true, fullName: true } },
      sourceOfInformation: { select: { id: true, name: true } },
      termOfPayments: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export type MiceBookingDetail = NonNullable<Awaited<ReturnType<typeof getMiceBookingById>>>;

export async function getSalesMiceProfiles() {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: { status: "active", role: { name: "sales-mice" } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type SalesMiceProfile = Awaited<ReturnType<typeof getSalesMiceProfiles>>[number];
