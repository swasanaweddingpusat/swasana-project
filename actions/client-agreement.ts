"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";

function generateAccessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function generateAgreementToken(bookingId: string) {
  const { session, error } = await requirePermission({ module: "client_agreement", action: "create" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`gen-agreement:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const token = randomUUID();
  const accessCode = generateAccessCode();
  const expiresAt = getExpiresAt();

  try {
    const existing = await db.clientAgreement.findUnique({ where: { bookingId } });

    if (existing?.status === "Signed") {
      return { success: false as const, error: "Agreement sudah ditandatangani, tidak bisa di-regenerate." };
    }

    const [agreement] = await db.$transaction([db.clientAgreement.upsert({
      where: { bookingId },
      update: { token, accessCode, expiresAt, status: "Pending", sentAt: null, viewedAt: null, signedAt: null },
      create: { bookingId, token, accessCode, expiresAt },
    })]);

    revalidateTag("bookings", "max");
    return { success: true as const, agreement };
  } catch (e) {
    console.error("[generateAgreementToken]", e);
    return { success: false as const, error: "Gagal generate token" };
  }
}

export async function markAgreementSent(bookingId: string) {
  const { session, error } = await requirePermission({ module: "client_agreement", action: "edit" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`agreement-sent:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    await db.$transaction([db.clientAgreement.update({
      where: { bookingId },
      data: { status: "Sent", sentAt: new Date() },
    })]);
    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[markAgreementSent]", e);
    return { success: false as const, error: "Gagal update status" };
  }
}
