"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessBooking } from "@/lib/access-control";
import { isBookingSnapshotFrozen } from "@/lib/booking-freeze";
import { refreshCurrentRevisionSnapshot, patchSnapshotPackageItems, patchSnapshotComplimentaries } from "@/lib/booking-revision";
import {
  saveSnapInternalItemsSchema,
  saveSnapVendorItemsSchema,
  saveSnapComplimentariesSchema,
  saveSnapTakeoutSchema,
} from "@/lib/validations/snap-package-items";
import { calcFinalFromFullPrice } from "@/lib/package-prices";
import { getTermPaidMapForBookings } from "@/lib/queries/ledger";
import { upsertCreditBalanceOp } from "@/lib/credit-balance";

// ─── Save snap_package_internal_items ────────────────────────────────────────

export async function saveSnapInternalItems(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit-package" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`snap-internal:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = saveSnapInternalItemsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const { bookingId, items } = parsed.data;

  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  // Internal items stay editable post-freeze (ops correcting item text/qty does not
  // require re-approval or re-signing) — captured only for audit below.
  const frozen = await isBookingSnapshotFrozen(bookingId);

  try {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapPackageInternalItem.deleteMany({ where: { bookingId } }),
      ...items.map((item, idx) =>
        db.snapPackageInternalItem.create({
          data: {
            bookingId,
            itemName: item.itemName,
            itemDescription: item.itemDescription ?? "",
            sortOrder: item.sortOrder ?? idx,
          },
        }),
      ),
    ];

    await db.$transaction(ops);

    // Keep the PO PDF in sync with the edited internal items: refresh the in-flight
    // revision when still unfrozen, or — post-signature — patch just the item fields
    // into the signed snapshot so the PDF reflects the correction. Best-effort.
    try {
      const refreshed = await refreshCurrentRevisionSnapshot(bookingId);
      if (!refreshed) await patchSnapshotPackageItems(bookingId);
    } catch (e) {
      console.error("[saveSnapInternalItems] revision snapshot refresh failed:", e);
    }

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_internal_items_updated",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { count: items.length, postFreeze: frozen },
      description: frozen
        ? `Updated ${items.length} internal package items (post-signature edit)`
        : `Updated ${items.length} internal package items`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveSnapInternalItems]", e);
    return { success: false, error: "Gagal menyimpan internal items." };
  }
}

// ─── Save snap_package_vendor_items ──────────────────────────────────────────

export async function saveSnapVendorItems(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit-package" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`snap-vendor-items:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = saveSnapVendorItemsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const { bookingId, items } = parsed.data;

  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  // Vendor items stay editable post-freeze (ops swap a vendor without re-approval).
  // Capture freeze + active revision BEFORE writing so we can detect a concurrent
  // editBooking material-change (which clears freeze, bumps currentRevisionId, and
  // rebuilds snap vendor rows from the master package). Without this, a vendor swap
  // saved concurrently with a material-change could be silently wiped. (H-02)
  const before = await db.booking.findUnique({
    where: { id: bookingId },
    select: { snapshotFrozenAt: true, currentRevisionId: true },
  });
  if (!before) return { success: false, error: "Booking tidak ditemukan." };
  const frozen = before.snapshotFrozenAt != null;

  try {
    // Preserve existing isTakeout flags — the vendor items editor only edits itemText,
    // not takeout state; we must not reset flags that saveSnapTakeout already set.
    const existingVendorItems = await db.snapPackageVendorItem.findMany({
      where: { bookingId },
      select: { categoryName: true, isTakeout: true },
    });
    const takeoutByCategoryName = new Map(existingVendorItems.map((r) => [r.categoryName, r.isTakeout]));

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapPackageVendorItem.deleteMany({ where: { bookingId } }),
      ...items.map((item, idx) =>
        db.snapPackageVendorItem.create({
          data: {
            bookingId,
            categoryId: item.categoryId ?? null,
            categoryName: item.categoryName,
            itemText: item.itemText,
            sortOrder: item.sortOrder ?? idx,
            // Prefer caller-supplied value; fall back to existing DB flag to avoid reset
            isTakeout: item.isTakeout ?? takeoutByCategoryName.get(item.categoryName) ?? false,
          },
        }),
      ),
    ];

    await db.$transaction(ops);

    // Detect a material-change that landed concurrently: if currentRevisionId moved
    // between our read and write, editBooking rebuilt the vendor rows from the master
    // package — our swap may be inconsistent with the new revision. Surface it so the
    // user can re-apply, instead of silently keeping a superseded write.
    const after = await db.booking.findUnique({
      where: { id: bookingId },
      select: { currentRevisionId: true },
    });
    if (after && after.currentRevisionId !== before.currentRevisionId) {
      await logAudit({
        userId: session!.user.id,
        action: "booking.snap_vendor_items_conflict",
        result: "failure",
        entityType: "booking",
        entityId: bookingId,
        changes: { from: before.currentRevisionId, to: after.currentRevisionId },
        description: "Vendor items disimpan saat booking sedang berubah (revisi baru) — perubahan mungkin tertimpa.",
      });
      return {
        success: false,
        error: "Booking baru saja diubah (revisi baru dibuat). Buka ulang & simpan item vendor sekali lagi.",
      };
    }

    // Keep the PO PDF in sync with the edited vendor items: refresh the in-flight
    // revision when still unfrozen, or — post-signature swap — patch just the item
    // fields into the signed snapshot so the PDF reflects the swap. Best-effort.
    try {
      const refreshed = await refreshCurrentRevisionSnapshot(bookingId);
      if (!refreshed) await patchSnapshotPackageItems(bookingId);
    } catch (e) {
      console.error("[saveSnapVendorItems] revision snapshot refresh failed:", e);
    }

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_vendor_items_updated",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { count: items.length, postFreeze: frozen },
      description: frozen
        ? `Updated ${items.length} vendor package items (post-signature swap)`
        : `Updated ${items.length} vendor package items`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveSnapVendorItems]", e);
    return { success: false, error: "Gagal menyimpan vendor items." };
  }
}

// ─── Save snap_complimentaries ────────────────────────────────────────────────

export async function saveSnapComplimentaries(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit-package" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`snap-compl:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = saveSnapComplimentariesSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  const { bookingId, items } = parsed.data;

  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapComplimentary.deleteMany({ where: { bookingId } }),
      ...items.map((item, idx) =>
        db.snapComplimentary.create({
          data: {
            bookingId,
            complimentaryId: item.complimentaryId ?? null,
            name: item.name,
            price: item.price ?? 0,
            isShowPrice: item.isShowPrice ?? false,
            description: item.description ?? null,
            qty: item.qty ?? 1,
            sortOrder: item.sortOrder ?? idx,
          },
        }),
      ),
    ];

    await db.$transaction(ops);

    // Keep the PO PDF in sync with the edited complimentaries: refresh the in-flight
    // revision when still unfrozen, or — post-signature — patch just the complimentaries
    // into the signed snapshot (complimentary is a non-trigger field, editable after
    // signature without re-approval). Best-effort.
    try {
      const refreshed = await refreshCurrentRevisionSnapshot(bookingId);
      if (!refreshed) await patchSnapshotComplimentaries(bookingId);
    } catch (e) {
      console.error("[saveSnapComplimentaries] revision snapshot refresh failed:", e);
    }

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_complimentaries_updated",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { count: items.length },
      description: `Updated ${items.length} complimentaries`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveSnapComplimentaries]", e);
    return { success: false, error: "Gagal menyimpan complimentaries." };
  }
}

// ─── Save snap takeout ────────────────────────────────────────────────────────

export async function saveSnapTakeout(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`snap-takeout:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = saveSnapTakeoutSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { bookingId, items } = parsed.data;

  try {
    // dataScope now comes straight off the JWT (no DB round-trip). We need
    // categoryId + isShow here to resolve which category IDs are taken out
    // (vendor items match by ID, not name).
    const scope = session!.user.dataScope ?? "own";
    const existingRows = await db.snapPackageCategoryPrice.findMany({
      where: { bookingId },
      select: {
        id: true,
        categoryName: true,
        categoryId: true,
        isShow: true,
        basePrice: true,
        isTakeout: true,
        takeoutNominal: true,
      },
    });

    if (!(await canAccessBooking(session!.user.profileId ?? "", scope, bookingId))) {
      return { success: false, error: "Booking tidak ditemukan atau akses ditolak." };
    }

    // Takeout toggles are ops decisions (which vendor provides what) — allowed even
    // after client signature. Only internal items and pricing revisions require re-approval.

    // Also fetch vendor item rows so we can sync isTakeout on them. Vendor items carry
    // a categoryId (nullable) — we match primarily on THAT, not categoryName, because
    // the vendor item's category label can differ from the price category label
    // (canonical editBooking logic matches by categoryId and calls categoryName "fragile").
    // We keep a categoryName fallback for legacy rows whose categoryId is null.
    // Takeout is a price-reducing deduction (net = fullPrice − Σ takeout), so a takeout
    // edit MUST recompute snapPackagePricing.price — otherwise the TOP tab (which reads
    // that stored price) keeps a stale value. The TOP schedule is deliberately NOT
    // auto-rebalanced here; the user reconciles the termin manually. Fetch what the
    // price recompute needs alongside the vendor-item rows.
    const [vendorItemRows, pricing, paidMap, bookingRow] = await Promise.all([
      db.snapPackageVendorItem.findMany({
        where: { bookingId },
        select: { id: true, categoryId: true, categoryName: true },
      }),
      db.snapPackagePricing.findUnique({
        where: { bookingId },
        select: { price: true, fullPrice: true },
      }),
      getTermPaidMapForBookings([bookingId]),
      db.booking.findUnique({ where: { id: bookingId }, select: { discountAmount: true } }),
    ]);

    const rowById = new Map(existingRows.map((r) => [r.categoryName, r.id]));

    // Build a lookup: categoryName → isTakeout from incoming items. Keys are
    // lowercased — real data has case drift between the price category label
    // ("CATERING") and the vendor item label ("Catering").
    const takeoutByCategory = new Map(items.map((item) => [item.categoryName.toLowerCase(), item.isTakeout]));

    // Resolve which category IDs are taken out — join incoming toggles (keyed by name)
    // to the snapshot category rows (which hold the categoryId) so vendor items can be
    // matched by ID. Only visible (isShow) categories can be taken out.
    const takeoutCategoryIds = new Set(
      existingRows
        .filter((r) => r.isShow && (takeoutByCategory.get(r.categoryName.toLowerCase()) ?? false) && r.categoryId)
        .map((r) => r.categoryId as string),
    );

    // Build update ops for each category-price row that has a matching row
    const ops: Prisma.PrismaPromise<unknown>[] = items
      .filter((item) => rowById.has(item.categoryName))
      .map((item) =>
        db.snapPackageCategoryPrice.update({
          where: { id: rowById.get(item.categoryName)! },
          data: {
            isTakeout: item.isTakeout,
            takeoutNominal: item.isTakeout ? item.takeoutNominal : 0,
          },
        }),
      );

    if (ops.length === 0) return { success: false, error: "Tidak ada kategori yang cocok." };

    // Sync isTakeout on vendor item snapshot rows (for PDF strikethrough rendering).
    // Primary match by categoryId; fall back to categoryName when the vendor item has
    // no categoryId (legacy data) so takeout still strikes it through in the PO.
    for (const vi of vendorItemRows) {
      const isTakeout = vi.categoryId
        ? takeoutCategoryIds.has(vi.categoryId)
        : (takeoutByCategory.get(vi.categoryName.toLowerCase()) ?? false);
      ops.push(
        db.snapPackageVendorItem.update({
          where: { id: vi.id },
          data: { isTakeout },
        }),
      );
    }

    // ── Recompute net price + rebalance TOP (takeout = deduction) ────────────────
    // Mirror the create→finalize path (calcFinalFromFullPrice + adjustTermsForPriceChange)
    // so price and schedule always reflect the takeout state just saved. Per product
    // decision, takeout recomputes price even on a signed (frozen) booking, but never
    // resets approval or re-triggers the client signature.
    if (pricing) {
      const incomingByName = new Map(items.map((i) => [i.categoryName, i]));
      const updatedCategories = existingRows.map((c) => {
        const incoming = incomingByName.get(c.categoryName);
        const isTakeout = c.isShow && (incoming ? incoming.isTakeout : c.isTakeout);
        const takeoutNominal = isTakeout
          ? incoming
            ? incoming.takeoutNominal
            : Number(c.takeoutNominal ?? 0)
          : 0;
        return { isShow: c.isShow, isTakeout, basePrice: Number(c.basePrice), takeoutNominal };
      });

      // fullPrice anchor: stored value; reconstruct for legacy rows (fullPrice = 0) from
      // current price + already-deducted takeout — matches updatePackagePrices.
      const fullPrice =
        pricing.fullPrice > 0
          ? pricing.fullPrice
          : Number(pricing.price) +
            existingRows
              .filter((c) => c.isShow && c.isTakeout)
              .reduce((s, c) => s + (Number(c.takeoutNominal ?? 0) || Number(c.basePrice)), 0);

      const newPrice = calcFinalFromFullPrice(updatedCategories, fullPrice);

      // Store the new net price so the TOP tab reads it — but do NOT touch the term
      // schedule. Σtermin stays as the user set it; the TOP tab surfaces the gap vs the
      // new price as "Selisih" and the user reconciles the termin manually. Overpay is
      // still recomputed because it tracks cash-vs-net (price − discount), not the schedule.
      const discountAmount = Number(bookingRow?.discountAmount ?? 0);
      const netAfter = Math.max(0, newPrice - discountAmount);
      const totalPaid = Array.from(paidMap.values()).reduce((s, v) => s + v, 0);
      const overpayAfter = Math.max(0, totalPaid - netAfter);

      ops.push(
        db.snapPackagePricing.update({
          where: { bookingId },
          data: { price: newPrice, fullPrice },
        }),
        upsertCreditBalanceOp(bookingId, overpayAfter),
      );
    }

    await db.$transaction(ops);

    // Re-freeze the in-flight revision snapshot so the PO PDF (which renders from
    // the revision, not the live tables) reflects the new takeout state. No-ops when
    // the revision is already frozen (client signed) — best-effort, never blocks the save.
    try {
      await refreshCurrentRevisionSnapshot(bookingId);
    } catch (e) {
      console.error("[saveSnapTakeout] revision snapshot refresh failed:", e);
    }

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_takeout_updated",
      result: "success",
      entityType: "Booking",
      entityId: bookingId,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveSnapTakeout]", e);
    return { success: false, error: "Gagal menyimpan takeout." };
  }
}
