"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { logAudit } from "@/lib/audit";
import { generateAccessCode } from "@/lib/access-code";

export async function generateAgreementToken(bookingId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "client-agreement" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`gen-agreement:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false as const, error: "Anda tidak memiliki akses ke booking ini." };
  }

  const token = randomUUID();
  const accessCode = generateAccessCode();

  try {
    // Regenerate ONLY swaps the link (token) + access code. The client's signature,
    // the approval steps, and the booking status are intentionally left untouched — a
    // lost/leaked link can be reissued without forcing a re-sign or bouncing the
    // booking back to Pending. status/sentAt/viewedAt/signedAt are preserved: if the
    // client had already signed, the new link simply opens the download page.
    // (When the PO CONTENT changes, the revision/edit flow — booking-revision.ts /
    // editBooking / set-harga — resets the agreement separately via its own inline
    // updateMany; that path is unaffected by this action.)
    const agreement = await db.clientAgreement.upsert({
      where: { bookingId },
      update: { token, accessCode },
      create: { bookingId, token, accessCode },
    });

    await logAudit({
      userId: session!.user.id,
      action: "client_agreement.regenerated",
      entityType: "booking",
      entityId: bookingId,
      description: "Link & kode akses agreement di-generate ulang (tanda tangan & status booking tidak diubah)",
    });

    revalidateTag("bookings", "max");
    return { success: true as const, agreement };
  } catch (e) {
    console.error("[generateAgreementToken]", e);
    return { success: false as const, error: "Gagal generate token" };
  }
}

export async function markAgreementSent(bookingId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "client-agreement" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`agreement-sent:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false as const, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    await db.$transaction([db.clientAgreement.update({
      where: { bookingId },
      data: { status: "Sent", sentAt: new Date() },
    })]);
    await logAudit({
      userId: session!.user.id,
      action: "client_agreement.sent",
      entityType: "booking",
      entityId: bookingId,
      description: `Link agreement dikirim ke client`,
    });
    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[markAgreementSent]", e);
    return { success: false as const, error: "Gagal update status" };
  }
}
