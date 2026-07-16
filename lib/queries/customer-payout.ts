import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export interface PayableRow {
  id: string;
  bookingId: string;
  /** Denormalized dari booking.snapCustomer.name. */
  clientName: string;
  type: "program_cashback" | "overpay_refund";
  status: "outstanding" | "paid" | "void";
  amount: number;
  programName: string | null;
  /** Bank tujuan "BCA 149" (bankName + 3 digit akhir). Null = Cash / belum diisi. */
  paymentMethod: string | null;
  disbursementNumber: string | null;
  settledAt: string | null;
  notes: string | null;
  createdAt: string;
}

/** Helper: fullName ?? nickName ?? null */
function profileName(
  p: { fullName: string | null; nickName: string | null } | null,
): string | null {
  return p?.fullName ?? p?.nickName ?? null;
}

export { profileName };

/* ─── Getters ────────────────────────────────────────────────────────────────── */

export interface GetPayablesParams {
  status?: "outstanding" | "paid" | "void";
  type?: "program_cashback" | "overpay_refund";
  bookingId?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Daftar payable (customer payout), paginated, cached.
 * Hard-capped pageSize=100 (AGENTS.md: findMany wajib paginated).
 */
export async function getPayables(
  params: GetPayablesParams = {},
): Promise<{ data: PayableRow[]; total: number }> {
  "use cache";
  cacheTag("customer-payables");
  cacheLife("minutes");

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.bookingId ? { bookingId: params.bookingId } : {}),
  };

  const [rows, total] = await Promise.all([
    db.bookingPayable.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        bookingId: true,
        type: true,
        status: true,
        amount: true,
        disbursementNumber: true,
        settledAt: true,
        notes: true,
        createdAt: true,
        booking: {
          select: {
            snapCustomer: { select: { name: true } },
          },
        },
        program: { select: { name: true } },
        paymentMethod: { select: { bankName: true, bankAccountNumber: true } },
      },
    }),
    db.bookingPayable.count({ where }),
  ]);

  const data: PayableRow[] = rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    clientName: r.booking.snapCustomer?.name ?? "-",
    type: r.type,
    status: r.status,
    amount: Number(r.amount),
    programName: r.program?.name ?? null,
    paymentMethod: r.paymentMethod
      ? `${r.paymentMethod.bankName} ${r.paymentMethod.bankAccountNumber.slice(-3)}`
      : null,
    disbursementNumber: r.disbursementNumber ?? null,
    settledAt: r.settledAt ? r.settledAt.toISOString() : null,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return { data, total };
}

/* ─── Summary ────────────────────────────────────────────────────────────────── */

export interface PayableSummary {
  totalOutstanding: number;
  totalPaidThisMonth: number;
  outstandingCount: number;
}

/**
 * Ringkasan dashboard AP-Customer: total outstanding, total terbayar bulan ini,
 * dan jumlah payable outstanding. Cached.
 */
export async function getPayableSummary(): Promise<PayableSummary> {
  "use cache";
  cacheTag("customer-payables");
  cacheLife("minutes");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [outstandingAgg, paidThisMonthAgg] = await Promise.all([
    db.bookingPayable.aggregate({
      where: { status: "outstanding" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.bookingPayable.aggregate({
      where: {
        status: "paid",
        settledAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalOutstanding: Number(outstandingAgg._sum.amount ?? 0),
    totalPaidThisMonth: Number(paidThisMonthAgg._sum.amount ?? 0),
    outstandingCount: outstandingAgg._count.id,
  };
}
