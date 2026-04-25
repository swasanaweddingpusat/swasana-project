"use server";

import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

type ApprovalRole = "finance" | "dirops" | "oprations";
type CategoryType = "catering" | "decoration";

export async function approveCategoryPO(
  bookingId: string,
  categoryType: CategoryType,
  role: ApprovalRole,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`approve-po:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { signatures: true },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const existing = (booking.signatures as Record<string, unknown>) ?? {};
    const categoryApprovals = (existing[categoryType] as Record<string, unknown>) ?? {};

    await db.booking.update({
      where: { id: bookingId },
      data: {
        signatures: JSON.parse(JSON.stringify({
          ...existing,
          [categoryType]: {
            ...categoryApprovals,
            [role]: {
              signature,
              userId: session!.user.profileId,
              name: session!.user.name ?? "",
              at: new Date().toISOString(),
            },
          },
        })),
      },
    });

    await logAudit({
      userId: session!.user.id,
      action: `booking.${categoryType}_${role}_approved`,
      entityType: "booking",
      entityId: bookingId,
      changes: { role, categoryType },
      description: `Approved ${categoryType} PO as ${role}`,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan approval." };
  }
}

export async function getCategoryApprovals(
  bookingId: string,
  categoryType: CategoryType
): Promise<Record<string, { signature: string; userId: string; name: string; at: string } | null>> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { signatures: true },
  });
  if (!booking) return { finance: null, dirops: null, oprations: null };

  const sigs = (booking.signatures as Record<string, unknown>) ?? {};
  const cat = (sigs[categoryType] as Record<string, unknown>) ?? {};

  return {
    finance: (cat.finance as { signature: string; userId: string; name: string; at: string }) ?? null,
    dirops: (cat.dirops as { signature: string; userId: string; name: string; at: string }) ?? null,
    oprations: (cat.oprations as { signature: string; userId: string; name: string; at: string }) ?? null,
  };
}
