"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { refreshCurrentRevisionSnapshot } from "@/lib/booking-revision";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

interface TermUpdate {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paymentStatus: "unpaid" | "paid" | "partial";
  notes?: string | null;
  /** Bank tujuan transfer per-term (nullable). Empty string / null clears it. */
  paymentMethodId?: string | null;
  /** Display order after drag-drop. Index in the on-screen list. */
  sortOrder?: number;
}

interface NewTerm {
  name: string;
  amount: number;
  dueDate: string;
  paymentStatus?: "unpaid" | "paid" | "partial";
  /** Bank tujuan transfer per-term (nullable). */
  paymentMethodId?: string | null;
  /** Display order after drag-drop. Index in the on-screen list. */
  sortOrder?: number;
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

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    // ── Guard: the payment schedule must reconcile to the package price ──────────
    // Total of all billable (non-refund) terms MUST equal price-after-discount.
    // Refund terms are a separate reconciliation and are never part of the payload,
    // so they are excluded here (mirrors the drawer's on-screen "Selisih"). Reject
    // a mismatched schedule server-side so an under/over-billed TOP can never persist,
    // even if the client-side guard is bypassed.
    const pricing = await db.snapPackagePricing.findUnique({
      where: { bookingId },
      select: { price: true },
    });
    const packagePrice = pricing?.price ?? 0;
    // Use the discount being saved when provided; otherwise the booking's stored value.
    let effectiveDiscount = discount?.discountAmount ?? 0;
    if (!discount) {
      const b = await db.booking.findUnique({ where: { id: bookingId }, select: { discountAmount: true } });
      effectiveDiscount = b?.discountAmount ?? 0;
    }
    const priceAfterDiscount = Math.max(0, packagePrice - effectiveDiscount);
    const totalTerms =
      terms.reduce((s, t) => s + (Number(t.amount) || 0), 0) +
      (newTerms?.reduce((s, t) => s + (Number(t.amount) || 0), 0) ?? 0);
    if (totalTerms !== priceAfterDiscount) {
      const diff = totalTerms - priceAfterDiscount;
      const fmt = new Intl.NumberFormat("id-ID").format(Math.abs(diff));
      return {
        success: false,
        error: `Total cicilan tidak sesuai harga paket. ${diff < 0 ? "Kurang" : "Lebih"} Rp${fmt}. Sesuaikan dulu sebelum menyimpan.`,
      };
    }

    // Fetch ALL terms for this booking so we can detect removed terms and
    // check ackStatus/paymentStatus for lock protection.
    const allDbTerms = await db.termOfPayment.findMany({
      where: { bookingId },
      select: { id: true, ackStatus: true, paymentStatus: true },
    });
    const ackMap = new Map(allDbTerms.map((t) => [t.id, t.ackStatus]));

    // Delete terms removed by the user. Locked terms (paid/refund/acknowledged)
    // are always preserved even if the client omitted them.
    const isLockedTerm = (t: { paymentStatus: string; ackStatus: string }): boolean =>
      t.paymentStatus === "paid" ||
      t.paymentStatus === "refund" ||
      t.ackStatus === "acknowledged";
    const lockedTermIds = new Set(allDbTerms.filter(isLockedTerm).map((t) => t.id));
    const clientTermIds = new Set(terms.map((t) => t.id));
    const keepIds = [...clientTermIds, ...lockedTermIds];

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.termOfPayment.deleteMany({ where: { bookingId, id: { notIn: keepIds } } }),
    ];

    // Reordering (sortOrder) is purely a display concern — it never touches
    // amount/status, so it is allowed even for acknowledged terms. For
    // acknowledged terms we therefore update ONLY sortOrder; for the rest we
    // update the full editable payload (including sortOrder when provided).
    for (const t of terms) {
      if (ackMap.get(t.id) === "acknowledged") {
        ops.push(db.termOfPayment.update({
          where: { id: t.id },
          data: t.sortOrder !== undefined ? { sortOrder: t.sortOrder } : {},
        }));
      } else {
        ops.push(db.termOfPayment.update({
          where: { id: t.id },
          data: {
            name: t.name,
            amount: t.amount,
            dueDate: new Date(t.dueDate),
            paymentStatus: t.paymentStatus,
            notes: t.notes ?? null,
            ...(t.paymentMethodId !== undefined && { paymentMethodId: t.paymentMethodId || null }),
            ...(t.sortOrder !== undefined && { sortOrder: t.sortOrder }),
          },
        }));
      }
    }

    // Add new terms. Use the explicit sortOrder from the reordered list when
    // provided; otherwise append after the current max (legacy behavior).
    if (newTerms && newTerms.length > 0) {
      const maxSort = await db.termOfPayment.findFirst({ where: { bookingId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      let nextSort = (maxSort?.sortOrder ?? -1) + 1;
      for (const t of newTerms) {
        ops.push(
          db.termOfPayment.create({
            data: {
              bookingId,
              name: t.name,
              amount: t.amount,
              dueDate: new Date(t.dueDate),
              paymentMethodId: t.paymentMethodId ?? null,
              sortOrder: t.sortOrder ?? nextSort++,
              paymentStatus: t.paymentStatus ?? "unpaid",
            },
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

    // Re-freeze the in-flight revision snapshot so the PO PDF (which renders TOP from
    // the revision, not the live term_of_payments) reflects the edited schedule/discount.
    // No-ops when the revision is frozen (client signed) — best-effort, never blocks the save.
    try {
      await refreshCurrentRevisionSnapshot(bookingId);
    } catch (e) {
      console.error("[updateTermOfPayments] revision snapshot refresh failed:", e);
    }

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

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    // Atomic sortOrder: compute MAX(sortOrder)+1 via a scalar subquery inside the
    // INSERT so two concurrent adds can't read the same max and collide. The VALUES
    // form always inserts exactly one row (the subquery yields 0 when no terms exist).
    // id/createdAt/updatedAt are Prisma-level defaults, so we set them explicitly here.
    const id = randomUUID();
    await db.$executeRaw(
      Prisma.sql`
        INSERT INTO term_of_payments ("id", "bookingId", "name", "amount", "dueDate", "sortOrder", "paymentStatus", "ackStatus", "createdAt", "updatedAt")
        VALUES (
          ${id}, ${bookingId}, ${data.name}, ${data.amount}, ${new Date(data.dueDate)},
          (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM term_of_payments WHERE "bookingId" = ${bookingId}),
          'unpaid'::"TermOfPaymentStatus", 'pending', NOW(), NOW()
        )
      `,
    );

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
