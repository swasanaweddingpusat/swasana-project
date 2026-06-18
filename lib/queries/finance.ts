import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TopRow = {
  amount: number | bigint;
  paymentStatus: string;
  ackStatus: string;
  partialPayments: { amount: number | bigint }[];
};

/**
 * Definisi piutang & kas diterima SAMA dengan groups.ts computeTopFinancials.
 * Cash-based:
 *   - Kas Diterima   = TOP paid + acknowledged
 *   - Piutang        = TOP unpaid + paid-not-acked + partial outstanding
 *   - Refund         = exclude (konsisten dengan ar.ts)
 */
function computeTopFinancials(tops: TopRow[]): {
  kasDiterima: number;
  piutang: number;
} {
  let kasDiterima = 0;
  let piutang = 0;

  for (const top of tops) {
    const amount = Number(top.amount);
    const paidSoFar = top.partialPayments.reduce((s, p) => s + Number(p.amount), 0);

    if (top.paymentStatus === "refund") continue;

    if (top.paymentStatus === "paid" && top.ackStatus === "acknowledged") {
      kasDiterima += amount;
    } else if (top.paymentStatus === "paid" && top.ackStatus !== "acknowledged") {
      piutang += amount;
    } else if (top.paymentStatus === "partial") {
      piutang += Math.max(0, amount - paidSoFar);
    } else if (top.paymentStatus === "unpaid") {
      piutang += amount;
    }
  }

  return { kasDiterima, piutang };
}

// ─── Company-wide finance overview ────────────────────────────────────────────

export interface CompanyFinanceSummary {
  /** Kas Diterima: TOP paid + acknowledged (cash-based) */
  kasDiterima: number;
  /** Piutang: TOP unpaid + paid-not-acked + partial outstanding */
  piutang: number;
  /**
   * Nilai Kontrak: harga paket booking Confirmed (sum snapPackagePricing.price).
   * Ini bukan kas — hanya angka kontrak yang sudah Confirmed.
   */
  nilaiKontrak: number;
  /** Sum semua target sales (latest per sales profile, type="sales") */
  totalTarget: number;
  /** totalBookingConfirmed count */
  totalConfirmed: number;
  /** Achievement % = nilaiKontrak / totalTarget * 100 (0 kalau target 0) */
  achievementPct: number;
}

export async function getCompanyFinanceSummary(
  startDate?: Date,
  endDate?: Date,
): Promise<CompanyFinanceSummary> {
  "use cache";
  cacheTag("finance-overview", "bookings");
  cacheLife("minutes");

  // ── Query 1: all active bookings (non-draft, non-Canceled) ──────────────────
  const bookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      bookingStatus: { not: BookingStatus.Canceled },
      ...(startDate && endDate ? { bookingDate: { gte: startDate, lte: endDate } } : {}),
    },
    select: {
      bookingStatus: true,
      snapPackagePricing: { select: { price: true } },
      termOfPayments: {
        select: {
          amount: true,
          paymentStatus: true,
          ackStatus: true,
          partialPayments: { select: { amount: true } },
        },
      },
    },
    take: 10_000,
  });

  // ── Query 2: latest target per sales profile, type="sales" ──────────────────
  // Group by profileId, keep only the latest (createdAt desc → first-write-wins)
  const allTargets = await db.userTarget.findMany({
    where: { type: "sales" },
    orderBy: { createdAt: "desc" },
    select: { profileId: true, amount: true },
    take: 2_000,
  });

  // Dedupe: latest per profileId
  const seenProfiles = new Set<string>();
  let totalTarget = 0;
  for (const t of allTargets) {
    if (!seenProfiles.has(t.profileId)) {
      seenProfiles.add(t.profileId);
      totalTarget += Number(t.amount);
    }
  }

  // ── In-memory aggregation ────────────────────────────────────────────────────
  let kasDiterima = 0;
  let piutang = 0;
  let nilaiKontrak = 0;
  let totalConfirmed = 0;

  for (const b of bookings) {
    const fin = computeTopFinancials(b.termOfPayments);
    kasDiterima += fin.kasDiterima;
    piutang += fin.piutang;

    if (b.bookingStatus === BookingStatus.Confirmed) {
      nilaiKontrak += b.snapPackagePricing?.price ?? 0;
      totalConfirmed += 1;
    }
  }

  const achievementPct = totalTarget > 0 ? Math.round((nilaiKontrak / totalTarget) * 100) : 0;

  return { kasDiterima, piutang, nilaiKontrak, totalTarget, totalConfirmed, achievementPct };
}

// ─── Per-group finance breakdown ──────────────────────────────────────────────

export interface GroupFinanceRow {
  id: string;
  name: string;
  kasDiterima: number;
  piutang: number;
  nilaiKontrak: number;
  achievementPct: number;
}

/**
 * Per-group finance breakdown — company-wide (tidak scoped ke user).
 * Reuse logika computeTopFinancials supaya definisi piutang/kas konsisten.
 */
export async function getGroupsFinanceBreakdown(
  startDate?: Date,
  endDate?: Date,
): Promise<GroupFinanceRow[]> {
  "use cache";
  cacheTag("finance-overview", "groups", "bookings");
  cacheLife("minutes");

  // ── Query 1: all groups + member salesIds ────────────────────────────────────
  const groups = await db.userGroup.findMany({
    select: {
      id: true,
      name: true,
      members: { select: { userId: true } },
    },
    orderBy: { name: "asc" },
  });

  if (groups.length === 0) return [];

  const allSalesIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))];

  // ── Query 2: all relevant bookings ──────────────────────────────────────────
  const bookings = await db.booking.findMany({
    where: {
      recordStatus: "saved",
      salesId: { in: allSalesIds },
      bookingStatus: { not: BookingStatus.Canceled },
      ...(startDate && endDate ? { bookingDate: { gte: startDate, lte: endDate } } : {}),
    },
    select: {
      salesId: true,
      bookingStatus: true,
      snapPackagePricing: { select: { price: true } },
      termOfPayments: {
        select: {
          amount: true,
          paymentStatus: true,
          ackStatus: true,
          partialPayments: { select: { amount: true } },
        },
      },
    },
    take: 10_000,
  });

  // ── Query 3: latest target per sales ────────────────────────────────────────
  const allTargets = await db.userTarget.findMany({
    where: { profileId: { in: allSalesIds }, type: "sales" },
    orderBy: { createdAt: "desc" },
    select: { profileId: true, amount: true },
    take: 2_000,
  });

  const targetBySalesId = new Map<string, number>();
  for (const t of allTargets) {
    if (!targetBySalesId.has(t.profileId)) {
      targetBySalesId.set(t.profileId, Number(t.amount));
    }
  }

  // ── Group bookings by salesId ────────────────────────────────────────────────
  const bookingsBySalesId = new Map<
    string,
    {
      bookingStatus: BookingStatus;
      price: number;
      tops: TopRow[];
    }[]
  >();
  for (const b of bookings) {
    if (!b.salesId) continue;
    const list = bookingsBySalesId.get(b.salesId) ?? [];
    list.push({
      bookingStatus: b.bookingStatus,
      price: b.snapPackagePricing?.price ?? 0,
      tops: b.termOfPayments,
    });
    bookingsBySalesId.set(b.salesId, list);
  }

  // ── Aggregate per group ──────────────────────────────────────────────────────
  return groups.map((g) => {
    let kasDiterima = 0;
    let piutang = 0;
    let nilaiKontrak = 0;
    let totalTarget = 0;

    for (const member of g.members) {
      const memberBookings = bookingsBySalesId.get(member.userId) ?? [];
      const target = targetBySalesId.get(member.userId) ?? 0;
      totalTarget += target;

      for (const b of memberBookings) {
        const fin = computeTopFinancials(b.tops);
        kasDiterima += fin.kasDiterima;
        piutang += fin.piutang;
        if (b.bookingStatus === BookingStatus.Confirmed) {
          nilaiKontrak += b.price;
        }
      }
    }

    const achievementPct = totalTarget > 0 ? Math.round((nilaiKontrak / totalTarget) * 100) : 0;

    return { id: g.id, name: g.name, kasDiterima, piutang, nilaiKontrak, achievementPct };
  });
}

// ─── Return types ─────────────────────────────────────────────────────────────

export type { CompanyFinanceSummary as FinanceOverviewSummary };
