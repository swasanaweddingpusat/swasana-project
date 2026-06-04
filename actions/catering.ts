"use server";

import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import type { CateringPaketData } from "@/types/catering";
import type { POCateringV2, PORow } from "@/types/po-catering";
import type { Prisma } from "@prisma/client";
import type { SettlementType } from "@prisma/client";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";

/**
 * Build array-form transaction ops for syncing settlement rows.
 * Pre-fetches existing rows so no intermediate-result dependency exists.
 * Returns Prisma array-form ops ready for db.$transaction([...]).
 */
async function buildSettlementOps(
  snapVendorItemId: string,
  bookingId: string,
  rows: PORow[],
  createdBy: string
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const settlementRows = rows.filter(
    (r) => r.type === "settlement" && r.grandTotal && r.grandTotal > 0 && !r.isIncoming
  );
  const incomingIds = new Set(settlementRows.map((r) => r.id));

  // Pre-fetch existing IDs to determine create vs update
  const existing = await db.bookingPaymentSettlement.findMany({
    where: { snapVendorItemId },
    select: { id: true, status: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // Delete rows removed by user (skip completed ones — they are locked)
  const toDeleteIds = existing
    .filter((e) => !incomingIds.has(e.id) && e.status !== "completed")
    .map((e) => e.id);

  if (toDeleteIds.length > 0) {
    ops.push(
      db.bookingPaymentSettlement.deleteMany({
        where: { id: { in: toDeleteIds } },
      })
    );
  }

  // Build create or update for each settlement row
  for (const row of settlementRows) {
    const settlementData = {
      type: (row.settlementType ?? "refund") as SettlementType,
      amount: row.grandTotal!,
      paymentMethodId: row.settlementPaymentMethodId ?? null,
      targetBookingId: row.targetBookingId ?? null,
      notes: row.settlementNotes ?? row.description ?? null,
    };

    if (existingIds.has(row.id)) {
      ops.push(
        db.bookingPaymentSettlement.update({
          where: { id: row.id },
          data: settlementData,
        })
      );
    } else {
      ops.push(
        db.bookingPaymentSettlement.create({
          data: {
            id: row.id,
            bookingId,
            snapVendorItemId,
            createdBy,
            ...settlementData,
          },
        })
      );
    }
  }

  return ops;
}

export async function saveCateringPaketData(
  snapVendorItemId: string,
  paketData: CateringPaketData
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`save-catering:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const item = await db.snapVendorItem.findUnique({
      where: { id: snapVendorItemId },
      select: { bookingId: true },
    });
    if (!item) return { success: false, error: "Vendor item tidak ditemukan." };

    const scope = await getProfileDataScope(session!.user.profileId);
    if (!(await canAccessBooking(session!.user.profileId, scope, item.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    await db.$transaction([
      db.snapVendorItem.update({
        where: { id: snapVendorItemId },
        data: { paketData: JSON.parse(JSON.stringify(paketData)) },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.catering_updated",
      entityType: "booking",
      entityId: item.bookingId,
      changes: { sections: paketData.sections.length },
      description: `Updated catering paket data (${paketData.sections.length} sections)`,
    });

    revalidateTag("caterings", "max");
    return { success: true };
  } catch (e) {
    console.error("[saveCateringPaketData]", e);
    return { success: false, error: "Gagal menyimpan data catering." };
  }
}

export async function savePOCateringData(
  snapVendorItemId: string,
  poData: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`save-po-catering:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const item = await db.snapVendorItem.findUnique({
      where: { id: snapVendorItemId },
      select: { bookingId: true },
    });
    if (!item) return { success: false, error: "Vendor item tidak ditemukan." };

    const scope = await getProfileDataScope(session!.user.profileId);
    if (!(await canAccessBooking(session!.user.profileId, scope, item.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    const typed = poData as POCateringV2;

    // Pre-fetch settlement state outside transaction (no intermediate-result dependency)
    const settlementOps = await buildSettlementOps(
      snapVendorItemId,
      item.bookingId,
      typed.rows ?? [],
      session!.user.id
    );

    await db.$transaction([
      db.snapVendorItem.update({
        where: { id: snapVendorItemId },
        data: { paketData: JSON.parse(JSON.stringify(poData)) },
      }),
      ...settlementOps,
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.po_catering_updated",
      entityType: "booking",
      entityId: item.bookingId,
      description: "Updated PO Catering table data",
    });

    revalidateTag("caterings", "max");
    return { success: true };
  } catch (e) {
    console.error("[savePOCateringData]", e);
    return { success: false, error: "Gagal menyimpan PO Catering." };
  }
}
