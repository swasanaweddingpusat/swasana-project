"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";

interface VendorSelection {
  vendorCategoryId: string;
  vendorCategoryName: string;
  vendorId: string;
  vendorName: string;
  nominal?: number;
  description?: string;
  orderStatusId?: string | null;
}

export async function saveBookingVendors(
  bookingId: string,
  selections: VendorSelection[]
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`save-vendors:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    // Only work with non-addons rows that have NO paketData (set by set-vendor-drawer)
    const existing = await db.snapVendorItem.findMany({
      where: { bookingId, isAddons: false, paketData: { equals: undefined } },
      select: { id: true, vendorCategoryId: true },
    });

    const existingMap = new Map(existing.map((e) => [e.vendorCategoryId, e.id]));
    const incomingCatIds = new Set(selections.map((s) => s.vendorCategoryId));

    // Delete rows for categories that user cleared (no longer in selections)
    const toDelete = existing.filter((e) => !incomingCatIds.has(e.vendorCategoryId)).map((e) => e.id);
    if (toDelete.length > 0) {
      await db.snapVendorItem.deleteMany({ where: { id: { in: toDelete } } });
    }

    // Upsert each selection
    for (const s of selections.filter((s) => s.vendorId)) {
      const existingId = existingMap.get(s.vendorCategoryId);
      if (existingId) {
        await db.snapVendorItem.update({
          where: { id: existingId },
          data: {
            vendorId: s.vendorId,
            vendorName: s.vendorName,
            itemName: s.vendorName,
            itemPrice: s.nominal ?? 0,
            totalPrice: s.nominal ?? 0,
            description: s.description ?? null,
            orderStatusId: s.orderStatusId ?? null,
          },
        });
      } else {
        await db.snapVendorItem.create({
          data: {
            bookingId,
            vendorCategoryId: s.vendorCategoryId,
            vendorCategoryName: s.vendorCategoryName,
            vendorId: s.vendorId,
            vendorName: s.vendorName,
            itemName: s.vendorName,
            itemPrice: s.nominal ?? 0,
            qty: 1,
            totalPrice: s.nominal ?? 0,
            description: s.description ?? null,
            orderStatusId: s.orderStatusId ?? null,
          },
        });
      }
    }

    await logAudit({
      userId: session.user.id,
      action: "booking.vendor_updated",
      entityType: "booking",
      entityId: bookingId,
      changes: { vendors: selections.filter((s) => s.vendorId).map((s) => s.vendorName) },
      description: `Updated ${selections.filter((s) => s.vendorId).length} vendors`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan vendor." };
  }
}

export async function updateSnapBonus(id: string, data: { vendorId?: string; vendorName?: string; nominal?: number; description?: string; orderStatusId?: string | null }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`update-bonus:${session.user.id}:${ip}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  try {
    await db.snapBonus.update({
      where: { id },
      data: {
        ...(data.vendorId && { vendorId: data.vendorId }),
        ...(data.vendorName && { vendorName: data.vendorName }),
        nominal: data.nominal ?? 0,
        description: data.description ?? null,
        orderStatusId: data.orderStatusId ?? null,
      },
    });
    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Gagal update bonus." };
  }
}

export async function addSnapBonus(bookingId: string, data: { vendorId: string; vendorCategoryId: string; vendorName: string; nominal?: number; description?: string; orderStatusId?: string | null }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`add-bonus:${session.user.id}:${ip}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  try {
    const item = await db.snapBonus.create({
      data: {
        bookingId,
        vendorId: data.vendorId,
        vendorCategoryId: data.vendorCategoryId,
        vendorName: data.vendorName,
        nominal: data.nominal ?? 0,
        description: data.description ?? null,
        orderStatusId: data.orderStatusId ?? null,
        qty: 1,
      },
      include: { orderStatus: { select: { id: true, name: true } } },
    });
    revalidateTag("bookings", "max");
    return { success: true as const, item };
  } catch {
    return { success: false as const, error: "Gagal menambah bonus." };
  }
}

export async function deleteSnapBonus(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan." };

  try {
    await db.snapBonus.delete({ where: { id } });
    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Gagal menghapus bonus." };
  }
}
