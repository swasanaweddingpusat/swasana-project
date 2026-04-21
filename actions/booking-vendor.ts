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
    // Delete existing non-addons snap vendor items, then insert new ones
    await db.$transaction([
      db.snapVendorItem.deleteMany({
        where: { bookingId, isAddons: false },
      }),
      ...selections
        .filter((s) => s.vendorId)
        .map((s) =>
          db.snapVendorItem.create({
            data: {
              bookingId,
              vendorCategoryId: s.vendorCategoryId,
              vendorCategoryName: s.vendorCategoryName,
              vendorId: s.vendorId,
              vendorName: s.vendorName,
              itemName: s.vendorName,
              itemPrice: 0,
              qty: 1,
              totalPrice: 0,
            },
          })
        ),
    ]);

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
