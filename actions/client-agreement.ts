"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { randomUUID } from "crypto";

function generateAccessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export async function generateAgreementToken(bookingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan." };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`gen-agreement:${session.user.id}:${ip}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const token = randomUUID();
  const accessCode = generateAccessCode();
  const expiresAt = getExpiresAt();

  try {
    const existing = await db.clientAgreement.findUnique({ where: { bookingId } });

    if (existing) {
      const agreement = await db.clientAgreement.update({
        where: { bookingId },
        data: { token, accessCode, expiresAt, status: "Pending", sentAt: null, viewedAt: null, signedAt: null },
      });
      return { success: true as const, agreement };
    }

    const agreement = await db.clientAgreement.create({
      data: { bookingId, token, accessCode, expiresAt },
    });
    return { success: true as const, agreement };
  } catch {
    return { success: false as const, error: "Gagal generate token" };
  }
}

export async function markAgreementSent(bookingId: string) {
  const { error } = await requirePermission({ module: "client_agreement", action: "edit" });
  if (error) return { success: false as const, error };

  try {
    await db.clientAgreement.update({
      where: { bookingId },
      data: { status: "Sent", sentAt: new Date() },
    });
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Gagal update status" };
  }
}
