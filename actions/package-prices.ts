"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { calcFinalFromFullPrice, computeFullPrice, adjustTermsForPriceChange } from "@/lib/package-prices";
import { createBookingRevision } from "@/lib/booking-revision";
import { buildBookingApprovalSteps } from "@/lib/approval-flows";
import type { Prisma } from "@prisma/client";
import { updateBookingCategoryPricesSchema } from "@/lib/validations/package";
import { getTermPaidMapForBookings } from "@/lib/queries/ledger";

const updatePackagePricesSchema = z.object({
  bookingId: z.string().min(1),
  categoryToggles: z
    .array(
      z.object({
        id: z.string().min(1),
        isTakeout: z.boolean(),
        takeoutNominal: z.coerce.number().int().min(0).default(0),
      }),
    )
    .min(1),
});

export async function updatePackagePrices(
  data: unknown,
): Promise<{ success: true; newPrice: number } | { success: false; error: string }> {
  // Allow booking:edit-set-harga OR finance-ar:edit
  const bookingPerm = await requirePermission({ module: "booking", action: "edit-set-harga" });
  const arPerm = await requirePermission({ module: "finance-ar", action: "edit" });
  if (bookingPerm.error && arPerm.error) {
    return { success: false, error: bookingPerm.error };
  }
  const session = bookingPerm.session ?? arPerm.session;
  if (!session) return { success: false, error: "Unauthorized." };

  if (!mutationLimiter.check(`pkg-prices:${session.user.id}`)) {
    return { success: false, error: "Terlalu banyak request. Coba lagi nanti." };
  }

  const parsed = updatePackagePricesSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { bookingId, categoryToggles } = parsed.data;

  try {
    const [snapVariant, allCategories, currentTerms, paidMap] = await Promise.all([
      db.snapPackagePricing.findUnique({
        where: { bookingId },
        select: { price: true, fullPrice: true, margin: true },
      }),
      db.snapPackageCategoryPrice.findMany({
        where: { bookingId },
        select: {
          id: true,
          categoryName: true,
          basePrice: true,
          sortOrder: true,
          isShow: true,
          isTakeout: true,
          takeoutNominal: true,
        },
      }),
      db.termOfPayment.findMany({
        where: { bookingId },
        select: { id: true, name: true, amount: true },
        orderBy: { sortOrder: "asc" },
      }),
      // Pure-derived: "sudah dibayar" per termin dari Ledger cash-in ter-ack.
      getTermPaidMapForBookings([bookingId]),
    ]);

    if (!snapVariant) {
      return { success: false, error: "Booking snapshot tidak ditemukan." };
    }

    // Apply incoming toggles + nominal (only for isShow=true rows)
    const toggleMap = new Map(categoryToggles.map((t) => [t.id, t.isTakeout]));
    const nominalMap = new Map(categoryToggles.map((t) => [t.id, t.takeoutNominal ?? 0]));
    const updatedCategories = allCategories.map((c) => {
      const isTakeout = c.isShow ? (toggleMap.get(c.id) ?? c.isTakeout) : false;
      const incomingNominal = nominalMap.get(c.id);
      return {
        ...c,
        isTakeout,
        takeoutNominal: isTakeout
          ? ((incomingNominal ?? c.takeoutNominal ?? 0) || c.basePrice)
          : 0,
      };
    });

    // At least one category must remain included
    const hasIncluded = updatedCategories.some((c) => !c.isTakeout);
    if (!hasIncluded) {
      return { success: false, error: "Minimal satu kategori harus tetap included." };
    }

    const oldPrice = snapVariant.price;
    // fullPrice anchor: use stored value; fall back for pre-migration rows by
    // reconstructing it from current price + already-deducted takeout nominals.
    const fullPrice =
      snapVariant.fullPrice > 0
        ? snapVariant.fullPrice
        : snapVariant.price +
          allCategories
            .filter((c) => c.isShow && c.isTakeout)
            .reduce((s, c) => s + ((c.takeoutNominal ?? 0) || c.basePrice), 0);
    const newPrice = calcFinalFromFullPrice(updatedCategories, fullPrice);
    // Set-to-target recompute: works both ways (takeout on → price down,
    // takeout off → price back up), so toggling restores original amounts.
    const { adjustedTerms } = adjustTermsForPriceChange(
      currentTerms.map((t) => ({
        id: t.id,
        name: t.name,
        amount: Number(t.amount),
        paid: paidMap.get(t.id) ?? 0,
      })),
      newPrice,
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // Update each visible category's isTakeout + takeoutNominal
      ...updatedCategories
        .filter((c) => toggleMap.has(c.id))
        .map((c) =>
          db.snapPackageCategoryPrice.update({
            where: { id: c.id },
            data: { isTakeout: c.isTakeout, takeoutNominal: c.takeoutNominal },
          }),
        ),
      // Update snapPackagePricing.price (and persist the anchor for legacy rows)
      db.snapPackagePricing.update({
        where: { bookingId },
        data: { price: newPrice, fullPrice },
      }),
      // Recompute editable (unpaid) terms toward the new price
      ...adjustedTerms.map((t) =>
        db.termOfPayment.update({
          where: { id: t.id },
          data: { amount: t.newAmount },
        }),
      ),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session.user.id,
      action: "booking.update_package_prices",
      entityType: "booking",
      entityId: bookingId,
      description: `Updated package category takeout. Old price: ${oldPrice}, New price: ${newPrice}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, newPrice };
  } catch (e) {
    console.error("[updatePackagePrices]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan." };
  }
}

/* ─── updateTakeoutWithTerms ──────────────────────────────────────────────────
 * Two-step takeout flow: apply category takeout AND the user-adjusted Term of
 * Payment amounts in a single transaction. The new price is recomputed on the
 * server from the category toggles (never trusted from the client); the client
 * only supplies the final TOP amounts for the editable (unpaid/partial,
 * non-acknowledged) pool, which the server validates to sum to the new price
 * minus the locked (paid/acknowledged) total.
 */
const updateTakeoutWithTermsSchema = z.object({
  bookingId: z.string().min(1),
  categoryToggles: z
    .array(
      z.object({
        id: z.string().min(1),
        isTakeout: z.boolean(),
        takeoutNominal: z.coerce.number().int().min(0).default(0),
      }),
    )
    .min(1),
  termOverrides: z
    .array(
      z.object({
        id: z.string().min(1),
        amount: z.coerce.number().int().min(0),
      }),
    )
    .default([]),
});

export async function updateTakeoutWithTerms(
  data: unknown,
): Promise<{ success: true; newPrice: number } | { success: false; error: string }> {
  // Allow booking:edit-set-harga OR finance-ar:edit (same as updatePackagePrices).
  const bookingPerm = await requirePermission({ module: "booking", action: "edit-set-harga" });
  const arPerm = await requirePermission({ module: "finance-ar", action: "edit" });
  if (bookingPerm.error && arPerm.error) {
    return { success: false, error: bookingPerm.error };
  }
  const session = bookingPerm.session ?? arPerm.session;
  if (!session) return { success: false, error: "Unauthorized." };

  if (!mutationLimiter.check(`pkg-prices:${session.user.id}`)) {
    return { success: false, error: "Terlalu banyak request. Coba lagi nanti." };
  }

  const parsed = updateTakeoutWithTermsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { bookingId, categoryToggles, termOverrides } = parsed.data;

  try {
    const [snapVariant, allCategories, currentTerms, takeoutPaidMap] = await Promise.all([
      db.snapPackagePricing.findUnique({
        where: { bookingId },
        select: { price: true, fullPrice: true, margin: true },
      }),
      db.snapPackageCategoryPrice.findMany({
        where: { bookingId },
        select: {
          id: true,
          categoryName: true,
          basePrice: true,
          sortOrder: true,
          isShow: true,
          isTakeout: true,
          takeoutNominal: true,
        },
      }),
      db.termOfPayment.findMany({
        where: { bookingId },
        select: { id: true, name: true, amount: true },
        orderBy: { sortOrder: "asc" },
      }),
      // Pure-derived guard (§6.6): term dengan alokasi Ledger ter-ack = terkunci dari pool
      getTermPaidMapForBookings([bookingId]),
    ]);

    if (!snapVariant) {
      return { success: false, error: "Booking snapshot tidak ditemukan." };
    }

    // ── Apply incoming category toggles (only isShow=true rows) ──
    const toggleMap = new Map(categoryToggles.map((t) => [t.id, t.isTakeout]));
    const nominalMap = new Map(categoryToggles.map((t) => [t.id, t.takeoutNominal ?? 0]));
    const updatedCategories = allCategories.map((c) => {
      const isTakeout = c.isShow ? (toggleMap.get(c.id) ?? c.isTakeout) : false;
      const incomingNominal = nominalMap.get(c.id);
      return {
        ...c,
        isTakeout,
        takeoutNominal: isTakeout
          ? ((incomingNominal ?? c.takeoutNominal ?? 0) || c.basePrice)
          : 0,
      };
    });

    const hasIncluded = updatedCategories.some((c) => !c.isTakeout);
    if (!hasIncluded) {
      return { success: false, error: "Minimal satu kategori harus tetap included." };
    }

    const oldPrice = snapVariant.price;
    const fullPrice =
      snapVariant.fullPrice > 0
        ? snapVariant.fullPrice
        : snapVariant.price +
          allCategories
            .filter((c) => c.isShow && c.isTakeout)
            .reduce((s, c) => s + ((c.takeoutNominal ?? 0) || c.basePrice), 0);
    const newPrice = calcFinalFromFullPrice(updatedCategories, fullPrice);

    // ── Validate the user-adjusted TOP override ──
    // Editable pool = termin TANPA alokasi Ledger cash-in ter-ack. Term yang sudah
    // ada uang masuk terverifikasi = immutable & mendanai harga lebih dulu.
    const pool = currentTerms.filter((t) => (takeoutPaidMap.get(t.id) ?? 0) === 0);
    const poolIds = new Set(pool.map((t) => t.id));
    const lockedTotal = currentTerms
      .filter((t) => !poolIds.has(t.id))
      .reduce((s, t) => s + Number(t.amount), 0);

    // Overrides may only target editable pool terms.
    const overrideMap = new Map(
      termOverrides.filter((o) => poolIds.has(o.id)).map((o) => [o.id, o.amount]),
    );

    const targetForPool = Math.max(0, newPrice - lockedTotal);

    // Final pool amounts: use override when provided, else keep current.
    const finalPool = pool.map((t) => ({
      id: t.id,
      amount: overrideMap.has(t.id) ? overrideMap.get(t.id)! : Number(t.amount),
    }));
    const poolSum = finalPool.reduce((s, t) => s + t.amount, 0);

    if (poolSum !== targetForPool) {
      return {
        success: false,
        error: `Total cicilan (Rp${poolSum.toLocaleString("id-ID")}) tidak sama dengan sisa tagihan (Rp${targetForPool.toLocaleString("id-ID")}). Sesuaikan dulu.`,
      };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // Persist category takeout changes.
      ...updatedCategories
        .filter((c) => toggleMap.has(c.id))
        .map((c) =>
          db.snapPackageCategoryPrice.update({
            where: { id: c.id },
            data: { isTakeout: c.isTakeout, takeoutNominal: c.takeoutNominal },
          }),
        ),
      // Persist new price + anchor.
      db.snapPackagePricing.update({
        where: { bookingId },
        data: { price: newPrice, fullPrice },
      }),
      // Apply user-adjusted pool amounts.
      ...finalPool.map((t) =>
        db.termOfPayment.update({ where: { id: t.id }, data: { amount: t.amount } }),
      ),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session.user.id,
      action: "booking.update_takeout_with_terms",
      entityType: "booking",
      entityId: bookingId,
      description: `Takeout + TOP adjust. Old price: ${oldPrice}, New price: ${newPrice}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, newPrice };
  } catch (e) {
    console.error("[updateTakeoutWithTerms]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan." };
  }
}

/* ─── updateBookingCategoryPrices ─────────────────────────────────────────────
 * Full replace of booking category price snapshot ("Set Harga" on booking).
 * Replaces snapPackageCategoryPrice rows wholesale, recomputes snapPackagePricing,
 * resets approval to pending, and invalidates the clientAgreement link — all in
 * a single array-form transaction (Neon HTTP compatible).
 *
 * TOP (termOfPayment) is intentionally NOT touched here. Takeout-adjusted TOP
 * changes are handled by updatePackagePrices / updateTakeoutWithTerms instead.
 */

export async function updateBookingCategoryPrices(
  data: unknown,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // 1. Permission check
  const { session, error } = await requirePermission({ module: "booking", action: "edit-set-harga" });
  if (error || !session) return { success: false, error: error ?? "Unauthorized" };

  // 2. Rate limit
  if (!mutationLimiter.check(`set-harga-booking:${session.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  // 3. Validate input
  const parsed = updateBookingCategoryPricesSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { bookingId, categories: newCategories, margin, sellingPrice } = parsed.data;

  try {
    // 4. Fetch existing snapshot rows to preserve isTakeout / takeoutNominal by categoryName match
    const [existingCategories, existingPricing, booking] = await Promise.all([
      db.snapPackageCategoryPrice.findMany({
        where: { bookingId },
        select: {
          categoryName: true,
          isTakeout: true,
          takeoutNominal: true,
        },
      }),
      db.snapPackagePricing.findUnique({
        where: { bookingId },
        select: { id: true },
      }),
      db.booking.findUnique({
        where: { id: bookingId },
        select: { salesId: true },
      }),
    ]);

    if (!existingPricing) {
      return { success: false, error: "Booking snapshot tidak ditemukan." };
    }
    if (!booking) {
      return { success: false, error: "Booking tidak ditemukan." };
    }

    // 5. Build takeout lookup from existing rows (preserve per categoryName)
    const existingTakeoutMap = new Map(
      existingCategories.map((c) => [
        c.categoryName,
        { isTakeout: c.isTakeout, takeoutNominal: c.takeoutNominal ?? 0 },
      ]),
    );

    // Merge new categories with existing takeout state
    const newCategoriesWithTakeout = newCategories.map((c) => {
      const existing = existingTakeoutMap.get(c.categoryName);
      return {
        ...c,
        isTakeout: existing?.isTakeout ?? false,
        takeoutNominal: existing?.takeoutNominal ?? 0,
      };
    });

    // 6. Compute fullPrice and final price
    const newFullPrice = computeFullPrice(newCategories, margin, sellingPrice);
    const newPrice = calcFinalFromFullPrice(newCategoriesWithTakeout, newFullPrice);

    // 7. Call createBookingRevision OUTSIDE transaction (snapshot reads current DB state)
    const revisionId = await createBookingRevision(
      bookingId,
      session.user.profileId!,
      "Perubahan harga paket",
    );

    // 8. Call buildBookingApprovalSteps OUTSIDE transaction
    const approvalSteps = await buildBookingApprovalSteps({
      salesId: booking.salesId,
      creatorProfileId: session.user.profileId!,
      signatureSales: null,
      decidedAt: new Date(),
      includeClientStep: true,
    });

    // 9. Get the existing approvalRecord to link new steps
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      select: { id: true },
    });

    // 10. Precompute clientAgreement invalidation values (before ops array)
    const newToken = crypto.randomUUID();
    const newAccessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 11. Build transaction ops array (array form — Neon HTTP compatible, NOT callback)
    const ops: Prisma.PrismaPromise<unknown>[] = [
      // Delete old snapshot category rows
      db.snapPackageCategoryPrice.deleteMany({ where: { bookingId } }),
      // Create new category rows
      db.snapPackageCategoryPrice.createMany({
        data: newCategoriesWithTakeout.map((c) => ({
          bookingId,
          categoryId: c.categoryId ?? null,
          categoryName: c.categoryName,
          basePrice: c.basePrice,
          sortOrder: c.sortOrder,
          isShow: c.isShow,
          isTakeout: c.isTakeout,
          takeoutNominal: c.takeoutNominal,
        })),
      }),
      // Update pricing snapshot
      db.snapPackagePricing.update({
        where: { bookingId },
        data: { fullPrice: newFullPrice, price: newPrice, margin },
      }),
      // Reset approval record to pending
      db.approvalRecord.updateMany({
        where: { module: "booking", entityId: bookingId },
        data: { status: "pending" },
      }),
      // Set booking back to Pending with updated currentRevisionId
      db.booking.update({
        where: { id: bookingId },
        data: { bookingStatus: "Pending", currentRevisionId: revisionId },
      }),
      // Invalidate clientAgreement (new token + access code, clear signatures)
      db.clientAgreement.updateMany({
        where: { bookingId },
        data: {
          status: "Pending",
          token: newToken,
          accessCode: newAccessCode,
          signedAt: null,
          viewedAt: null,
        },
      }),
      // Spread new approval steps (linked to the new revisionId)
      ...(approvalRecord && approvalSteps && approvalSteps.length > 0
        ? approvalSteps.map((step) =>
            db.approvalRecordStep.create({
              data: {
                recordId: approvalRecord.id,
                stepOrder: step.stepOrder,
                approverType: step.approverType,
                approverRoleId: step.approverRoleId,
                approverUserId: step.approverUserId,
                status: step.status,
                decidedById: step.decidedById,
                decidedAt: step.decidedAt,
                signature: step.signature,
                revisionId,
              },
            }),
          )
        : []),
    ];

    // 12. Execute atomic transaction (array form)
    await db.$transaction(ops);

    // 13. Audit log
    await logAudit({
      userId: session.user.id,
      action: "booking.set_harga",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      description: `Set harga paket booking. fullPrice: ${newFullPrice}, price: ${newPrice}, margin: ${margin}`,
    });

    // 14. Invalidate cache
    revalidateTag("bookings", "max");

    return { success: true };
  } catch (e) {
    console.error("[updateBookingCategoryPrices]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan harga." };
  }
}
