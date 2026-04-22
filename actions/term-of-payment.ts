"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

interface TermUpdate {
  id: string;
  amount: number;
  dueDate: string;
  paymentStatus: "unpaid" | "paid" | "partial";
  notes?: string | null;
}

export async function updateTermOfPayments(bookingId: string, terms: TermUpdate[]) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  try {
    for (const t of terms) {
      await db.termOfPayment.update({
        where: { id: t.id },
        data: {
          amount: BigInt(t.amount),
          dueDate: new Date(t.dueDate),
          paymentStatus: t.paymentStatus,
          notes: t.notes ?? null,
        },
      });
    }

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: bookingId,
      description: `Updated ${terms.length} term(s) of payment`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateTermOfPayments]", e);
    return { success: false, error: "Gagal memperbarui TOP." };
  }
}

export async function addTermOfPayment(bookingId: string, data: { name: string; amount: number; dueDate: string }) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  try {
    const maxSort = await db.termOfPayment.findFirst({ where: { bookingId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.termOfPayment.create({
      data: {
        bookingId,
        name: data.name,
        amount: BigInt(data.amount),
        dueDate: new Date(data.dueDate),
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      },
    });

    await logAudit({
      userId: session!.user.id,
      action: "created",
      entityType: "term_of_payment",
      entityId: bookingId,
      description: `Added term: ${data.name}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[addTermOfPayment]", e);
    return { success: false, error: "Gagal menambah skema." };
  }
}
