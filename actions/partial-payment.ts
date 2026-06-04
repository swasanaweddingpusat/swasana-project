"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";

export async function addPartialPayment(termId: string, data: { amount: number; paidAt: string; notes?: string }) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`partial-pay:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!termId || !data.amount || !data.paidAt) return { success: false, error: "Data tidak lengkap." };

  try {
    const term = await db.termOfPayment.findUnique({
      where: { id: termId },
      select: { id: true, bookingId: true, name: true, amount: true, partialPayments: { select: { amount: true } } },
    });
    if (!term) return { success: false, error: "Term tidak ditemukan." };

    const scope = await getProfileDataScope(session!.user.profileId);
    if (!(await canAccessBooking(session!.user.profileId, scope, term.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    const totalPaid = term.partialPayments.reduce((s, p) => s + p.amount, 0) + data.amount;
    const newStatus = totalPaid >= term.amount ? "paid" : "partial";

    const [payment] = await db.$transaction([
      db.partialPayment.create({
        data: { termId, amount: data.amount, paidAt: new Date(data.paidAt), notes: data.notes ?? null },
      }),
      db.termOfPayment.update({
        where: { id: termId },
        data: { paymentStatus: newStatus },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "created",
      entityType: "partial_payment",
      entityId: term.bookingId,
      description: `Partial payment Rp${new Intl.NumberFormat("id-ID").format(data.amount)} untuk ${term.name}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, paymentId: payment.id, newStatus };
  } catch (e) {
    console.error("[addPartialPayment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePartialPayment(paymentId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  try {
    const payment = await db.partialPayment.findUnique({
      where: { id: paymentId },
      select: { id: true, amount: true, term: { select: { id: true, bookingId: true, name: true, amount: true, partialPayments: { select: { amount: true } } } } },
    });
    if (!payment) return { success: false, error: "Payment tidak ditemukan." };

    const scope = await getProfileDataScope(session!.user.profileId);
    if (!(await canAccessBooking(session!.user.profileId, scope, payment.term.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    const remainingPaid = payment.term.partialPayments.reduce((s, p) => s + p.amount, 0) - payment.amount;
    const newStatus = remainingPaid <= 0 ? "unpaid" : remainingPaid >= payment.term.amount ? "paid" : "partial";

    await db.$transaction([
      db.partialPayment.delete({ where: { id: paymentId } }),
      db.termOfPayment.update({ where: { id: payment.term.id }, data: { paymentStatus: newStatus } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "partial_payment",
      entityId: payment.term.bookingId,
      description: `Hapus partial payment Rp${new Intl.NumberFormat("id-ID").format(payment.amount)} dari ${payment.term.name}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, newStatus };
  } catch (e) {
    console.error("[deletePartialPayment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
