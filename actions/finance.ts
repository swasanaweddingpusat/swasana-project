"use server";

import { getARBookings } from "@/lib/queries/ar";
import type { ARBookingsResult } from "@/lib/queries/ar";
import { requirePermission } from "@/lib/permissions";
import { apiLimiter, rateLimitError } from "@/lib/rate-limit";

export async function fetchARBookings(): Promise<{ success: true; data: ARBookingsResult } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "finance_ar", action: "view" });
  if (error) return { success: false, error };
  if (!apiLimiter.check(`ar-bookings:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const data = await getARBookings();
    return { success: true, data };
  } catch (e) {
    console.error("[fetchARBookings]", e);
    return { success: false, error: "Gagal memuat data piutang." };
  }
}
