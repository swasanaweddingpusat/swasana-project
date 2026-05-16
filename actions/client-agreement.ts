"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";

function generateAccessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

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
  const expiresAt = getExpiresAt();

  try {
    const [agreement] = await db.$transaction([db.clientAgreement.upsert({
      where: { bookingId },
      update: { token, accessCode, expiresAt, status: "Pending", sentAt: null, viewedAt: null, signedAt: null },
      create: { bookingId, token, accessCode, expiresAt },
    })]);

    revalidateTag("bookings", { expire: 0 });
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
    revalidateTag("bookings", { expire: 0 });
    return { success: true as const };
  } catch (e) {
    console.error("[markAgreementSent]", e);
    return { success: false as const, error: "Gagal update status" };
  }
}
