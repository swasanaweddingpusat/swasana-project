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

// ─── Main query ───────────────────────────────────────────────────────────────

/**
 * Returns top-5 sales ranked by confirmed revenue (highest first).
 * Admin (profileId = undefined) sees all sales.
 * Non-admin scoped to the given profileId list (their group members).
 *
 * BigInt `UserTarget.amount` is converted to Number before returning —
 * safe for amounts up to ~9 quadrillion IDR.
 */
export async function getTopSalesByRecentBooking(
  startDate: Date,
  endDate: Date,
  allowedProfileIds?: string[],
): Promise<SalesPerformanceCardItem[]> {
  "use cache";
  cacheTag("bookings", "groups");
  cacheLife("minutes");

  // Step 1: Get all distinct salesIds active in the date range (candidates pool).
  // Cap at 500 rows to bound memory; deduplication done in-memory.
  const candidateBookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      eventDate: { gte: startDate, lte: endDate },
      ...(allowedProfileIds ? { salesId: { in: allowedProfileIds } } : {}),
    },
    select: { salesId: true },
    take: 500,
  });

  const candidateSalesIds = [...new Set(candidateBookings.map((b) => b.salesId))];

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

// ─── Return type alias ────────────────────────────────────────────────────────

export type TopSalesItem = SalesPerformanceCardItem;
