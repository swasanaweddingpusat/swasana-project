"use server";

import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { CateringPaketData } from "@/types/catering";
import type { POCateringV2, PORow } from "@/types/po-catering";
import type { SettlementType } from "@/types/settlement";

async function syncSettlementRows(
  snapVendorItemId: string,
  bookingId: string,
  rows: PORow[],
  createdBy: string
) {
  const settlementRows = rows.filter((r) => r.type === "settlement" && r.grandTotal && r.grandTotal > 0 && !r.isIncoming);
  const rowIds = settlementRows.map((r) => r.id);

  // Delete settlements no longer in rows
  await db.bookingPaymentSettlement.deleteMany({
    where: { snapVendorItemId, id: { notIn: rowIds }, status: { not: "completed" } },
  });

  // Upsert each settlement row
  for (const row of settlementRows) {
    await db.bookingPaymentSettlement.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        bookingId,
        snapVendorItemId,
        type: (row.settlementType ?? "refund") as SettlementType,
        amount: BigInt(row.grandTotal!),
        paymentMethodId: row.settlementPaymentMethodId ?? null,
        targetBookingId: row.targetBookingId ?? null,
        notes: row.settlementNotes ?? row.description ?? null,
        createdBy,
      },
      update: {
        type: (row.settlementType ?? "refund") as SettlementType,
        amount: BigInt(row.grandTotal!),
        paymentMethodId: row.settlementPaymentMethodId ?? null,
        targetBookingId: row.targetBookingId ?? null,
        notes: row.settlementNotes ?? row.description ?? null,
      },
    });
  }
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

    await db.snapVendorItem.update({
      where: { id: snapVendorItemId },
      data: { paketData: JSON.parse(JSON.stringify(paketData)) },
    });

    await logAudit({
      userId: session!.user.id,
      action: "booking.catering_updated",
      entityType: "booking",
      entityId: item.bookingId,
      changes: { sections: paketData.sections.length },
      description: `Updated catering paket data (${paketData.sections.length} sections)`,
    });

    return { success: true };
  } catch {
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

    const typed = poData as POCateringV2;

    await db.snapVendorItem.update({
      where: { id: snapVendorItemId },
      data: { paketData: JSON.parse(JSON.stringify(poData)) },
    });

    await syncSettlementRows(snapVendorItemId, item.bookingId, typed.rows ?? [], session!.user.id);

    await logAudit({
      userId: session!.user.id,
      action: "booking.po_catering_updated",
      entityType: "booking",
      entityId: item.bookingId,
      description: "Updated PO Catering table data",
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan PO Catering." };
  }
}
