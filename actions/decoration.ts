"use server";

import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { POCateringV2 } from "@/types/po-catering";
import type { SettlementType } from "@/types/settlement";
import type { PORow } from "@/types/po-catering";

async function syncSettlementRows(
  snapVendorItemId: string,
  bookingId: string,
  rows: PORow[],
  createdBy: string
) {
  const settlementRows = rows.filter((r) => r.type === "settlement" && r.grandTotal && r.grandTotal > 0 && !r.isIncoming);
  const rowIds = settlementRows.map((r) => r.id);

  await db.bookingPaymentSettlement.deleteMany({
    where: { snapVendorItemId, id: { notIn: rowIds }, status: { not: "completed" } },
  });

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

export async function savePODecorationData(
  snapVendorItemId: string,
  poData: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`save-po-decoration:${session!.user.id}`)) return { success: false, ...rateLimitError() };

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
      action: "booking.po_decoration_updated",
      entityType: "booking",
      entityId: item.bookingId,
      description: "Updated PO Decoration table data",
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan PO Dekorasi." };
  }
}
