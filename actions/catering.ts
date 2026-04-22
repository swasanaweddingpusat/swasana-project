"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import type { CateringPaketData } from "@/types/catering";

export async function saveCateringPaketData(
  snapVendorItemId: string,
  paketData: CateringPaketData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`save-catering:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

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
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`save-po-catering:${session.user.id}:${ip}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    const item = await db.snapVendorItem.findUnique({
      where: { id: snapVendorItemId },
      select: { bookingId: true },
    });
    if (!item) return { success: false, error: "Vendor item tidak ditemukan." };

    await db.snapVendorItem.update({
      where: { id: snapVendorItemId },
      data: { paketData: JSON.parse(JSON.stringify(poData)) },
    });

    await logAudit({
      userId: session.user.id,
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
