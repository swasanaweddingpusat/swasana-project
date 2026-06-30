"use server";

import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import {
  saveSnapInternalItemsSchema,
  saveSnapVendorItemsSchema,
  saveSnapComplimentariesSchema,
  saveSnapTakeoutSchema,
} from "@/lib/validations/snap-package-items";

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

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

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

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_internal_items_updated",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { count: items.length },
      description: `Updated ${items.length} internal package items`,
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

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.snapPackageVendorItem.deleteMany({ where: { bookingId } }),
      ...items.map((item, idx) =>
        db.snapPackageVendorItem.create({
          data: {
            bookingId,
            categoryName: item.categoryName,
            itemText: item.itemText,
            sortOrder: item.sortOrder ?? idx,
            isTakeout: item.isTakeout ?? false,
          },
        }),
      ),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "booking.snap_vendor_items_updated",
      result: "success",
      entityType: "booking",
      entityId: bookingId,
      changes: { count: items.length },
      description: `Updated ${items.length} vendor package items`,
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

  const scope = await getProfileDataScope(session!.user.profileId);
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

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId ?? "", scope, bookingId))) {
    return { success: false, error: "Booking tidak ditemukan atau akses ditolak." };
  }

  try {
    // Fetch existing snapPackageCategoryPrice rows to get their IDs
    const existingRows = await db.snapPackageCategoryPrice.findMany({
      where: { bookingId },
      select: { id: true, categoryName: true },
    });
    const rowById = new Map(existingRows.map((r) => [r.categoryName, r.id]));

    // Build update ops for each item that has a matching row
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

    await db.$transaction(ops);

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
