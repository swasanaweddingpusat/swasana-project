"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { calcFinalFromFullPrice, adjustTermsForPriceChange } from "@/lib/package-prices";
import type { Prisma } from "@prisma/client";

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
  // Allow booking:edit OR finance-ar:edit
  const bookingPerm = await requirePermission({ module: "booking", action: "edit" });
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
    const [snapVariant, allCategories, currentTerms] = await Promise.all([
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
        where: { bookingId, paymentStatus: { not: "refund" } },
        select: { id: true, name: true, amount: true, paymentStatus: true, ackStatus: true },
        orderBy: { sortOrder: "asc" },
      }),
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
    const { adjustedTerms, refundTerm } = adjustTermsForPriceChange(
      currentTerms.map((t) => ({ ...t, amount: Number(t.amount) })),
      newPrice,
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [
      // Drop any prior refund terms first — they are recreated below only when
      // an overpayment still exists. Prevents stale/duplicate refund rows.
      db.termOfPayment.deleteMany({
        where: { bookingId, paymentStatus: "refund" },
      }),
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
      // Recompute unpaid/partial terms toward the new price
      ...adjustedTerms.map((t) =>
        db.termOfPayment.update({
          where: { id: t.id },
          data: { amount: t.newAmount },
        }),
      ),
      // Insert refund term if overpayment occurred
      ...(refundTerm
        ? [
            db.termOfPayment.create({
              data: {
                bookingId,
                name: refundTerm.name,
                amount: refundTerm.amount,
                paymentStatus: "refund",
                dueDate: new Date(),
                sortOrder: 999,
              },
            }),
          ]
        : []),
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
