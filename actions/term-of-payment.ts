"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";

interface TermUpdate {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paymentStatus: "unpaid" | "paid" | "partial";
  notes?: string | null;
}

interface NewTerm {
  name: string;
  amount: number;
  dueDate: string;
}

interface DiscountUpdate {
  discountName: string;
  discountAmount: number;
}

export async function updateTermOfPayments(
  bookingId: string,
  terms: TermUpdate[],
  newTerms?: NewTerm[],
  discount?: DiscountUpdate,
) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`top-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = terms.map((t) =>
      db.termOfPayment.update({
        where: { id: t.id },
        data: {
          name: t.name,
          amount: t.amount,
          dueDate: new Date(t.dueDate),
          paymentStatus: t.paymentStatus,
          notes: t.notes ?? null,
        },
      })
    );

    // Add new terms
    if (newTerms && newTerms.length > 0) {
      const maxSort = await db.termOfPayment.findFirst({ where: { bookingId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      let nextSort = (maxSort?.sortOrder ?? -1) + 1;
      for (const t of newTerms) {
        ops.push(
          db.termOfPayment.create({
            data: { bookingId, name: t.name, amount: t.amount, dueDate: new Date(t.dueDate), sortOrder: nextSort++ },
          })
        );
      }
    }

    // Update discount on booking
    if (discount) {
      ops.push(
        db.booking.update({
          where: { id: bookingId },
          data: { discountName: discount.discountName, discountAmount: discount.discountAmount },
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "updated",
      entityType: "booking",
      entityId: bookingId,
      description: `Updated ${terms.length} term(s)${newTerms?.length ? `, added ${newTerms.length} new term(s)` : ""}${discount ? ", updated discount" : ""}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateTermOfPayments]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function addTermOfPayment(bookingId: string, data: { name: string; amount: number; dueDate: string }) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`top-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const maxSort = await db.termOfPayment.findFirst({ where: { bookingId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await db.$transaction([
      db.termOfPayment.create({
        data: {
          bookingId,
          name: data.name,
          amount: data.amount,
          dueDate: new Date(data.dueDate),
          sortOrder: (maxSort?.sortOrder ?? -1) + 1,
        },
      }),
    ]);

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
    return { success: false, error: "Terjadi kesalahan." };
  }
}
