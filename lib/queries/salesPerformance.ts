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
  confirmedBookings: number;
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
  const confirmed = bookings.filter(
    (b) => b.bookingStatus === BookingStatus.Confirmed,
  );

  const weddings = confirmed.filter((b) => b.category === EventCategory.WEDDINGS);
  const mice = confirmed.filter((b) => b.category === EventCategory.MICE);

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
  startDate: Date,
  endDate: Date,
  allowedProfileIds?: string[],
): Promise<SalesPerformanceCardItem[]> {
  // Step 1: Get all distinct salesIds active in the date range (candidates pool).
  // Cap at 500 rows to bound memory; deduplication done in-memory.
  const candidateBookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      // Exclude "tanpa PIC" bookings (salesId null) — they belong to no sales and
      // must not be attributed to anyone's performance.
      salesId: allowedProfileIds ? { in: allowedProfileIds } : { not: null },
      eventDate: { gte: startDate, lte: endDate },
    },
    select: { salesId: true },
    take: 500,
  });

  const candidateSalesIds = [
    ...new Set(candidateBookings.map((b) => b.salesId).filter((id): id is string => id !== null)),
  ];

  if (candidateSalesIds.length === 0) return [];

  // Step 2: Fetch all bookings + profiles + targets for all candidates.
  const [allBookings, profiles, targets] = await Promise.all([
    db.booking.findMany({
      where: {
        recordStatus: "saved",
        salesId: { in: candidateSalesIds },
        eventDate: { gte: startDate, lte: endDate },
        bookingStatus: { not: BookingStatus.Canceled },
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

  // Step 4: Aggregate all candidates, sort by confirmed revenue desc, take top 5.
  const aggregated = candidateSalesIds.map((profileId) => {
    const profile = profileMap.get(profileId);
    const bookings = bookingsBySalesId.get(profileId) ?? [];
    const confirmed = bookings.filter(
      (b) => b.bookingStatus === BookingStatus.Confirmed,
    );
    const revenue = confirmed.reduce((s, b) => s + b.price, 0);
    const confirmedBookings = confirmed.length;
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
      confirmedBookings,
      target,
      hasTarget,
      achievementPct,
      breakdown,
    };
  });

  // Sort by confirmed revenue descending, then slice to top 5.
  return aggregated
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

// ─── Cached wrapper ──────────────────────────────────────────────────────────

export async function getTopSalesByRecentBooking(
  startDate: Date,
  endDate: Date,
  allowedProfileIds?: string[],
): Promise<SalesPerformanceCardItem[]> {
  "use cache";
  cacheTag("bookings", "groups");
  cacheLife("minutes");

  return _queryTopSales(startDate, endDate, allowedProfileIds);
}

// ─── Raw (uncached) for API route ────────────────────────────────────────────

export async function getTopSalesByRecentBookingRaw(
  startDate: Date,
  endDate: Date,
  allowedProfileIds?: string[],
): Promise<SalesPerformanceCardItem[]> {
  return _queryTopSales(startDate, endDate, allowedProfileIds);
}

// ─── Return type alias ────────────────────────────────────────────────────────

export type TopSalesItem = SalesPerformanceCardItem;
