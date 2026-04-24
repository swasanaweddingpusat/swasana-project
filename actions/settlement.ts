"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import type { SettlementType, SettlementStatus } from "@prisma/client";

export async function createSettlement(input: {
  snapVendorItemId: string;
  type: SettlementType;
  amount: number;
  paymentMethodId?: string;
  targetBookingId?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`settlement-create:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

  if (input.type === "refund" && !input.paymentMethodId) {
    return { success: false, error: "Payment method wajib diisi untuk refund." };
  }
  if (input.type === "allocation" && !input.targetBookingId) {
    return { success: false, error: "Target booking wajib diisi untuk alokasi." };
  }

  try {
    const item = await db.snapVendorItem.findUnique({
      where: { id: input.snapVendorItemId },
      select: { bookingId: true },
    });
    if (!item) return { success: false, error: "Vendor item tidak ditemukan." };

    const settlement = await db.$transaction([
      db.bookingPaymentSettlement.create({
        data: {
          bookingId: item.bookingId,
          snapVendorItemId: input.snapVendorItemId,
          type: input.type,
          amount: BigInt(input.amount),
          paymentMethodId: input.paymentMethodId ?? null,
          targetBookingId: input.targetBookingId ?? null,
          notes: input.notes ?? null,
          createdBy: session.user.id,
        },
        select: { id: true },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: `booking.settlement_${input.type}_created`,
      entityType: "booking",
      entityId: item.bookingId,
      description: `Created ${input.type} settlement of Rp${input.amount.toLocaleString("id-ID")}`,
    });

    return { success: true, data: { id: settlement[0].id } };
  } catch {
    return { success: false, error: "Gagal membuat settlement." };
  }
}

export async function updateSettlementStatus(
  settlementId: string,
  status: SettlementStatus,
  settledAt?: Date
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`settlement-update:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    const existing = await db.bookingPaymentSettlement.findUnique({
      where: { id: settlementId },
      select: { bookingId: true },
    });
    if (!existing) return { success: false, error: "Settlement tidak ditemukan." };

    await db.$transaction([
      db.bookingPaymentSettlement.update({
        where: { id: settlementId },
        data: {
          status,
          settledAt: status === "completed" ? (settledAt ?? new Date()) : null,
        },
      }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "booking.settlement_status_updated",
      entityType: "booking",
      entityId: existing.bookingId,
      description: `Settlement status updated to ${status}`,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengupdate status settlement." };
  }
}

export async function deleteSettlement(
  settlementId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`settlement-delete:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    const existing = await db.bookingPaymentSettlement.findUnique({
      where: { id: settlementId },
      select: { bookingId: true, status: true },
    });
    if (!existing) return { success: false, error: "Settlement tidak ditemukan." };
    if (existing.status === "completed") {
      return { success: false, error: "Settlement yang sudah completed tidak bisa dihapus." };
    }

    await db.$transaction([
      db.bookingPaymentSettlement.delete({ where: { id: settlementId } }),
    ]);

    await logAudit({
      userId: session.user.id,
      action: "booking.settlement_deleted",
      entityType: "booking",
      entityId: existing.bookingId,
      description: "Settlement deleted",
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus settlement." };
  }
}
