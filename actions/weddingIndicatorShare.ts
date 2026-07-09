"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import { generateAccessCode } from "@/lib/access-code";

export async function generateShareLink(indicatorId: string) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "edit",
  });
  if (error || !session) {
    return { success: false as const, error: error || "Unauthorized" };
  }
  if (!mutationLimiter.check(`wi-share-gen:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const indicator = await db.weddingIndicator.findUnique({
    where: { id: indicatorId },
    select: { id: true },
  });
  if (!indicator) {
    return { success: false as const, error: "Indikator tidak ditemukan" };
  }

  const token = randomUUID();
  const accessCode = generateAccessCode();

  try {
    const share = await db.weddingIndicatorShare.upsert({
      where: { weddingIndicatorId: indicatorId },
      update: {
        token,
        accessCode,
        status: "Active",
        viewedAt: null,
        lastEditedAt: null,
      },
      create: {
        weddingIndicatorId: indicatorId,
        token,
        accessCode,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "wedding_indicator_share.generated",
      result: "success",
      entityType: "wedding_indicator",
      entityId: indicatorId,
    });

    revalidateTag("wedding-indicators", "max");

    return {
      success: true as const,
      share: {
        token: share.token,
        accessCode: share.accessCode,
      },
    };
  } catch (e) {
    console.error("[generateShareLink]", e);
    return { success: false as const, error: "Gagal generate share link" };
  }
}

export async function revokeShareLink(indicatorId: string) {
  const { session, error } = await requirePermission({
    module: "vendor-specialist",
    action: "edit",
  });
  if (error || !session) {
    return { success: false as const, error: error || "Unauthorized" };
  }
  if (!mutationLimiter.check(`wi-share-revoke:${session.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  try {
    await db.weddingIndicatorShare.update({
      where: { weddingIndicatorId: indicatorId },
      data: { status: "Revoked" },
    });

    await logAudit({
      userId: session.user.id,
      action: "wedding_indicator_share.revoked",
      result: "success",
      entityType: "wedding_indicator",
      entityId: indicatorId,
    });

    revalidateTag("wedding-indicators", "max");

    return { success: true as const };
  } catch (e) {
    console.error("[revokeShareLink]", e);
    return { success: false as const, error: "Gagal revoke share link" };
  }
}
