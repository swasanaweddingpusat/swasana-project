import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus, EventCategory } from "@prisma/client";

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
 * Returns top-5 sales by most recently created booking.
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

  // Step 1: Get top-5 most-recently-active salesIds in the date range.
  // We query up to 500 bookings ordered by createdAt desc, then deduplicate
  // salesId in-memory to get the 5 most recent distinct sellers.
  const recentBookings = await db.booking.findMany({
    where: {
      bookingDate: { gte: startDate, lte: endDate },
      ...(allowedProfileIds ? { salesId: { in: allowedProfileIds } } : {}),
    },
    select: { salesId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const top5SalesIds: string[] = [];
  for (const b of recentBookings) {
    if (!top5SalesIds.includes(b.salesId)) {
      top5SalesIds.push(b.salesId);
      if (top5SalesIds.length === 5) break;
    }
  }

  if (top5SalesIds.length === 0) return [];

  // Step 2: Fetch all bookings for these 5 sales in the date range (for aggregation).
  const [allBookings, profiles, targets] = await Promise.all([
    db.booking.findMany({
      where: {
        salesId: { in: top5SalesIds },
        bookingDate: { gte: startDate, lte: endDate },
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
      where: { id: { in: top5SalesIds } },
      select: { id: true, fullName: true, avatarUrl: true },
    }),

    db.userTarget.findMany({
      where: {
        profileId: { in: top5SalesIds },
        type: "sales",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      orderBy: { endDate: "desc" },
      select: { profileId: true, amount: true },
    }),
  ]);

  // Step 3: Build lookup maps.
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // First-write-wins = latest target (because ordered by endDate desc).
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

  // Step 4: Compose result — preserve top5SalesIds order (most recent first).
  return top5SalesIds.map((profileId) => {
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
      avatarUrl: profile?.avatarUrl ?? null,
      revenue,
      confirmedBookings,
      target,
      hasTarget,
      achievementPct,
      breakdown,
    };
  });
}

// ─── Return type alias ────────────────────────────────────────────────────────

export type TopSalesItem = SalesPerformanceCardItem;
