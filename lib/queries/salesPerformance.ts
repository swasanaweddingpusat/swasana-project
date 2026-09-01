import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus, EventCategory } from "@prisma/client";
import { resolveAvatarUrl } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesCategoryBreakdown {
  weddings: { count: number; revenue: number };
  mice: { count: number; revenue: number };
}

export interface SalesPerformanceCardItem {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  revenue: number;
  bookingCount: number;
  target: number;
  hasTarget: boolean;
  achievementPct: number;
  breakdown: SalesCategoryBreakdown;
}

// ─── Helper: compute category breakdown in-memory ─────────────────────────────

function computeBreakdown(
  bookings: {
    bookingStatus: BookingStatus;
    category: EventCategory;
    price: number;
  }[],
): SalesCategoryBreakdown {
  const weddings = bookings.filter((b) => b.category === EventCategory.WEDDINGS);
  const mice = bookings.filter((b) => b.category === EventCategory.MICE);

  return {
    weddings: {
      count: weddings.length,
      revenue: weddings.reduce((s, b) => s + b.price, 0),
    },
    mice: {
      count: mice.length,
      revenue: mice.reduce((s, b) => s + b.price, 0),
    },
  };
}

// ─── Internal query logic ─────────────────────────────────────────────────────

async function _queryTopSales(
  allowedProfileIds?: string[],
  range?: { from: Date; to: Date },
  eventRange?: { from: Date; to: Date },
): Promise<SalesPerformanceCardItem[]> {
  // Step 1: Get all distinct salesIds with saved bookings (candidates pool),
  // optionally scoped to a dealing-date (createdAt) `range` and/or an
  // event-date (eventDate) `eventRange` — both AND together when given, falls
  // back to whole-database (all-time) when omitted. Ranks confirmed revenue
  // within the caller's access scope. `distinct` returns every salesId in one
  // round-trip without a truncating row cap (a raw `take` here could silently
  // drop sales whose bookings fall past the cap).
  const candidateBookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      // Exclude "tanpa PIC" bookings (salesId null) — they belong to no sales and
      // must not be attributed to anyone's performance.
      salesId: allowedProfileIds ? { in: allowedProfileIds } : { not: null },
      ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}),
      ...(eventRange ? { eventDate: { gte: eventRange.from, lt: eventRange.to } } : {}),
    },
    distinct: ["salesId"],
    select: { salesId: true },
  });

  const candidateSalesIds = candidateBookings
    .map((b) => b.salesId)
    .filter((id): id is string => id !== null);

  if (candidateSalesIds.length === 0) return [];

  // Step 2: Fetch all bookings + profiles + targets for all candidates.
  const [allBookings, profiles, targets] = await Promise.all([
    db.booking.findMany({
      where: {
        recordStatus: "saved",
        salesId: { in: candidateSalesIds },
        bookingStatus: { notIn: [BookingStatus.Canceled, BookingStatus.Lost] },
        ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}),
        ...(eventRange ? { eventDate: { gte: eventRange.from, lt: eventRange.to } } : {}),
      },
      select: {
        salesId: true,
        bookingStatus: true,
        category: true,
        snapPackagePricing: { select: { price: true } },
      },
      take: 5000,
    }),

    db.profile.findMany({
      where: { id: { in: candidateSalesIds } },
      select: { id: true, fullName: true, avatarUrl: true },
    }),

    db.userTarget.findMany({
      where: {
        profileId: { in: candidateSalesIds },
        type: "sales",
      },
      orderBy: { createdAt: "desc" },
      select: { profileId: true, amount: true },
    }),
  ]);

  // Step 3: Build lookup maps.
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // First-write-wins = latest target (because ordered by createdAt desc).
  const targetMap = new Map<string, number>();
  const hasTargetMap = new Map<string, boolean>();
  for (const t of targets) {
    if (!targetMap.has(t.profileId)) {
      targetMap.set(t.profileId, Number(t.amount));
      hasTargetMap.set(t.profileId, true);
    }
  }

  // Group bookings by salesId.
  const bookingsBySalesId = new Map<
    string,
    { bookingStatus: BookingStatus; category: EventCategory; price: number }[]
  >();
  for (const b of allBookings) {
    // salesId is nullable ("tanpa PIC"); the query already filters to candidate
    // salesIds so this is a type-narrowing guard, never expected to skip a row.
    if (!b.salesId) continue;
    const list = bookingsBySalesId.get(b.salesId) ?? [];
    list.push({
      bookingStatus: b.bookingStatus,
      category: b.category,
      price: b.snapPackagePricing?.price ?? 0,
    });
    bookingsBySalesId.set(b.salesId, list);
  }

  // Step 4: Aggregate all candidates, sort by confirmed revenue desc (all sales).
  const aggregated = candidateSalesIds.map((profileId) => {
    const profile = profileMap.get(profileId);
    const bookings = bookingsBySalesId.get(profileId) ?? [];
    // Revenue & count = semua booking yang ter-fetch (query sudah exclude Lost/Canceled),
    // jadi Confirmed + Pending + Uploaded + Rejected semuanya ikut — konsisten dengan
    // Group Revenue Rule di lib/queries/groups.ts.
    const revenue = bookings.reduce((s, b) => s + b.price, 0);
    const bookingCount = bookings.length;
    const target = targetMap.get(profileId) ?? 0;
    const hasTarget = hasTargetMap.get(profileId) ?? false;
    const achievementPct =
      hasTarget && target > 0 ? Math.round((revenue / target) * 100) : 0;
    const breakdown = computeBreakdown(bookings);

    return {
      profileId,
      name: profile?.fullName ?? "—",
      avatarUrl: resolveAvatarUrl(profile?.avatarUrl),
      revenue,
      bookingCount,
      target,
      hasTarget,
      achievementPct,
      breakdown,
    };
  });

  // Sort by confirmed revenue descending — return every sales, not just the top few.
  return aggregated.sort((a, b) => b.revenue - a.revenue);
}

// ─── Cached wrapper ──────────────────────────────────────────────────────────

export async function getTopSalesByRecentBooking(
  allowedProfileIds?: string[],
  range?: { from: Date; to: Date },
  eventRange?: { from: Date; to: Date },
): Promise<SalesPerformanceCardItem[]> {
  "use cache";
  cacheTag("bookings", "groups");
  cacheLife("minutes");

  return _queryTopSales(allowedProfileIds, range, eventRange);
}

// ─── Raw (uncached) for API route ────────────────────────────────────────────

export async function getTopSalesByRecentBookingRaw(
  allowedProfileIds?: string[],
  range?: { from: Date; to: Date },
  eventRange?: { from: Date; to: Date },
): Promise<SalesPerformanceCardItem[]> {
  return _queryTopSales(allowedProfileIds, range, eventRange);
}

// ─── Return type alias ────────────────────────────────────────────────────────

export type TopSalesItem = SalesPerformanceCardItem;
