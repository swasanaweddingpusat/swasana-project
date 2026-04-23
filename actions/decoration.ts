"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";

export async function savePODecorationData(
  snapVendorItemId: string,
  poData: unknown
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`save-po-decoration:${session.user.id}:${ip}`)) {
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
