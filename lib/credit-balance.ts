import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getTermPaidMapForBookings } from "@/lib/queries/ledger";

/**
 * Overpayment for a booking, in integer IDR: max(0, Σ acked cash-in (gross) − net owed).
 * Net = snapPackagePricing.price − booking.discountAmount (floored at 0). Acked cash-in
 * is the gross allocation total from `getTermPaidMapForBookings` (direction=in,
 * ackStatus=acknowledged, non-void).
 */
export async function computeOverpay(bookingId: string): Promise<number> {
  const [pricing, booking, paidMap] = await Promise.all([
    db.snapPackagePricing.findUnique({ where: { bookingId }, select: { price: true } }),
    db.booking.findUnique({ where: { id: bookingId }, select: { discountAmount: true } }),
    getTermPaidMapForBookings([bookingId]),
  ]);
  const net = Math.max(0, (pricing?.price ?? 0) - (booking?.discountAmount ?? 0));
  const totalPaid = Array.from(paidMap.values()).reduce((s, v) => s + v, 0);
  return Math.max(0, totalPaid - net);
}

/**
 * Prisma op that materializes the credit balance for a booking. Push into the
 * caller's array-form `$transaction([...])` so it is atomic with the effect that
 * changed the balance (ack, price change, schedule change). Neon HTTP supports
 * `upsert` inside the array batch.
 */
export function upsertCreditBalanceOp(
  bookingId: string,
  amount: number,
): Prisma.PrismaPromise<unknown> {
  return db.creditBalance.upsert({
    where: { bookingId },
    create: { bookingId, amount },
    update: { amount },
  });
}
