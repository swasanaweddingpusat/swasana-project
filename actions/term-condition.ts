"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessBooking } from "@/lib/access-control";

/**
 * Updates the per-booking Term & Condition. The PO PDF renders T&C from the
 * booking's frozen snapshot (`snapPackagePricing.termAndCondition`), NOT from
 * the Package master — so this edits the snapshot, leaving the package template
 * untouched. Permission `booking:term-&-condition` is granted to every role.
 */
export async function updateBookingTC(
  bookingId: string,
  termAndCondition: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "term-&-condition" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`booking-tc:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const snap = await db.snapPackagePricing.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (!snap) return { success: false, error: "Data paket booking tidak ditemukan." };

    await db.$transaction([
      db.snapPackagePricing.update({
        where: { bookingId },
        data: { termAndCondition },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "booking.update_tc",
      entityType: "booking",
      entityId: bookingId,
      description: `Updated Term & Condition for booking ${bookingId}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateBookingTC]", e);
    return { success: false, error: "Gagal menyimpan Term & Condition." };
  }
}
