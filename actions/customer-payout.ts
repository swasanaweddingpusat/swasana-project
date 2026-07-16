"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { logAudit } from "@/lib/audit";
import { computeOverpay, upsertCreditBalanceOp } from "@/lib/credit-balance";
import {
  createPayableSchema,
  disbursePayableSchema,
  voidPayableSchema,
} from "@/lib/validations/customer-payout";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type ActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/* ─── createPayable ──────────────────────────────────────────────────────────── */

/**
 * Buat kewajiban keluar ke customer (status=outstanding).
 * Kas belum gerak — hanya mencatat hutang. Disburse lewat `disbursePayable`.
 */
export async function createPayable(
  input: unknown,
): Promise<ActionResult<{ payableId: string }>> {
  const { session, error } = await requirePermission({ module: "finance-ap", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payable-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createPayableSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  try {
    // Guard overpay_refund: tidak boleh refund melebihi kelebihan bayar riil.
    if (data.type === "overpay_refund") {
      const overpay = await computeOverpay(data.bookingId);
      if (data.amount > overpay) {
        return { success: false, error: "Refund melebihi kelebihan bayar." };
      }
    }

    const profileId = session!.user.profileId!;

    const [created] = await db.$transaction([
      db.bookingPayable.create({
        data: {
          bookingId: data.bookingId,
          type: data.type,
          amount: data.amount,
          programId: data.programId ?? null,
          sourceLedgerId: data.sourceLedgerId ?? null,
          notes: data.notes ?? null,
          status: "outstanding",
          createdById: profileId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "payable.created",
      entityType: "booking-payable",
      entityId: created.id,
      changes: { bookingId: data.bookingId, type: data.type, amount: data.amount },
      description: `Payable ${data.type} ${data.amount} dibuat untuk booking ${data.bookingId}`,
    });

    revalidateTag("customer-payables", "max");
    return { success: true, data: { payableId: created.id } };
  } catch (e) {
    console.error("[createPayable]", e);
    return { success: false, error: "Gagal membuat payable." };
  }
}

/* ─── disbursePayable ────────────────────────────────────────────────────────── */

/**
 * Cairkan payable: kas keluar riil → tulis Ledger direction=out + update payable=paid.
 * Kalau type=overpay_refund, kurangi CreditBalance materialized secara atomik.
 *
 * Disbursement number: `<seq4>/AP/<venue>/<bln-angka>/<thn>`
 * Ledger: direction=out, ackStatus=acknowledged (self-acknowledged, tidak butuh verifikasi Finance).
 * Tidak ada PaymentAllocation (out tidak offset termin AR).
 */
export async function disbursePayable(
  input: unknown,
): Promise<ActionResult<{ ledgerId: string; disbursementNumber: string }>> {
  const { session, error } = await requirePermission({ module: "finance-ap", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payable-disburse:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = disbursePayableSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { payableId, paymentMethodId, occurredAt: occurredAtStr, notes } = parsed.data;

  try {
    // Load payable — verifikasi status outstanding.
    const payable = await db.bookingPayable.findUnique({
      where: { id: payableId },
      select: { id: true, bookingId: true, type: true, amount: true, status: true },
    });
    if (!payable) return { success: false, error: "Payable tidak ditemukan." };
    if (payable.status !== "outstanding") {
      return { success: false, error: "Payable sudah diproses atau dibatalkan." };
    }

    // Load booking untuk venue code + snap labels.
    const booking = await db.booking.findUnique({
      where: { id: payable.bookingId },
      select: {
        venue: { select: { code: true } },
        snapPackagePricing: { select: { packageName: true } },
        snapVenue: { select: { venueName: true } },
      },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const occurredAt = new Date(occurredAtStr);
    const venueCode = booking.venue?.code ?? "VN";
    const year = occurredAt.getFullYear();
    const month = (occurredAt.getMonth() + 1).toString().padStart(2, "0");

    // Mint disbursement number (atomic sequence, terpisah dari kwitansi/invoice).
    const seq = await getNextSequence(`ap-disbursement-${year}`);
    const disbursementNumber = `${seq.toString().padStart(4, "0")}/AP/${venueCode}/${month}/${year}`;

    // Pre-generate ledgerId biar bisa di-link ke BookingPayable.settlementLedgerId
    // dalam satu array-form transaction (pola createCashIn baris 219).
    const ledgerId = crypto.randomUUID();
    const profileId = session!.user.profileId!;

    // Untuk overpay_refund: hitung sisa overpay SEBELUM transaksi
    // (computeOverpay async — tidak bisa di dalam ops array).
    let newOverpay: number | null = null;
    if (payable.type === "overpay_refund") {
      const currentOverpay = await computeOverpay(payable.bookingId);
      newOverpay = Math.max(0, currentOverpay - payable.amount);
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // 1. Ledger direction=out (kas keluar riil). Tanpa PaymentAllocation karena
      //    out tidak offset termin AR. invoiceNumber=null (kwitansi khusus cash-in).
      db.ledger.create({
        data: {
          id: ledgerId,
          bookingId: payable.bookingId,
          direction: "out",
          ackStatus: "acknowledged",
          paymentStatus: "paid",
          occurredAt,
          amount: payable.amount,
          discountAmount: 0,
          cashAmount: payable.amount,
          paymentMethodId,
          invoiceNumber: null,
          notes: notes ?? null,
          snapTopName: null,
          snapPackageName: booking.snapPackagePricing?.packageName ?? null,
          snapVenueName: booking.snapVenue?.venueName ?? null,
          createdById: profileId,
          acknowledgedById: profileId,
          acknowledgedAt: occurredAt,
        },
      }),
      // 2. Update payable → paid + link ke Ledger out.
      db.bookingPayable.update({
        where: { id: payableId },
        data: {
          status: "paid",
          settlementLedgerId: ledgerId,
          paymentMethodId,
          disbursementNumber,
          settledAt: occurredAt,
          settledById: profileId,
        },
      }),
    ];

    // 3. Kalau overpay_refund: kurangi CreditBalance materialized secara atomik.
    if (newOverpay !== null) {
      ops.push(upsertCreditBalanceOp(payable.bookingId, newOverpay));
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "payable.disbursed",
      entityType: "booking-payable",
      entityId: payableId,
      changes: { ledgerId, disbursementNumber, amount: payable.amount },
      description: `Payable ${payableId} dicairkan: ${disbursementNumber}`,
    });

    revalidateTag("customer-payables", "max");
    revalidateTag("ledger", "max");
    return { success: true, data: { ledgerId, disbursementNumber } };
  } catch (e) {
    console.error("[disbursePayable]", e);
    return { success: false, error: "Gagal mencairkan payable." };
  }
}

/* ─── voidPayable ────────────────────────────────────────────────────────────── */

/**
 * Batalkan payable outstanding. Payable yang sudah `paid` tidak bisa di-void —
 * kas sudah keluar; koreksi lewat void Ledger row terpisah (di luar scope v1).
 */
export async function voidPayable(input: unknown): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ap", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payable-void:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = voidPayableSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { payableId, notes } = parsed.data;

  try {
    const payable = await db.bookingPayable.findUnique({
      where: { id: payableId },
      select: { id: true, status: true, notes: true },
    });
    if (!payable) return { success: false, error: "Payable tidak ditemukan." };
    if (payable.status !== "outstanding") {
      return { success: false, error: "Hanya payable outstanding yang bisa dibatalkan." };
    }

    // Alasan void di-APPEND ke notes yang ada (jangan overwrite catatan asli).
    // Tanpa alasan → notes dibiarkan apa adanya.
    const voidReason = notes?.trim();
    const mergedNotes = voidReason
      ? [payable.notes, `[Batal] ${voidReason}`].filter(Boolean).join("\n")
      : payable.notes;

    await db.$transaction([
      db.bookingPayable.update({
        where: { id: payableId },
        data: {
          status: "void",
          notes: mergedNotes,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "payable.voided",
      entityType: "booking-payable",
      entityId: payableId,
      description: `Payable ${payableId} dibatalkan`,
    });

    revalidateTag("customer-payables", "max");
    return { success: true };
  } catch (e) {
    console.error("[voidPayable]", e);
    return { success: false, error: "Gagal membatalkan payable." };
  }
}
