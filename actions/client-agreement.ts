"use server";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { logAudit } from "@/lib/audit";

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
    // Regenerating a link means the previously-signed PO is being replaced, so any
    // existing client signature in the approval flow is now stale. Read the approval
    // record up front and, when the client step is already approved, reset it back to
    // pending (clearing the signature) within the SAME transaction as the upsert.
    // Internal steps (Sales/Manager/Finance) stay approved — only the client must
    // re-sign the updated PO. Booking drops back to Pending until they do.
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { currentRevisionId: true },
    });

    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    type RecordStep = NonNullable<typeof approvalRecord>["steps"][number];
    let signedClientStep: RecordStep | null = null;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.clientAgreement.upsert({
        where: { bookingId },
        update: { token, accessCode, expiresAt, status: "Pending", sentAt: null, viewedAt: null, signedAt: null },
        create: { bookingId, token, accessCode, expiresAt },
      }),
    ];

    if (approvalRecord) {
      const allSteps = approvalRecord.steps;

      // Mirror the revision-scoping used when signing (see sign/route.ts): only the
      // active revision's steps count; legacy pre-snapshot bookings use all steps.
      const currentRevisionId = booking?.currentRevisionId ?? null;
      const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
      const revisionSteps = (currentRevisionId && hasRevisionedSteps)
        ? allSteps.filter((s) => s.revisionId === currentRevisionId)
        : allSteps;

      signedClientStep = revisionSteps.find(
        (s) => s.approverType === "client" && s.status === "approved"
      ) ?? null;

      if (signedClientStep) {
        ops.push(
          db.approvalRecordStep.update({
            where: { id: signedClientStep.id },
            data: { status: "pending", signature: null, decidedById: null, decidedAt: null },
          }),
          db.approvalRecord.update({
            where: { id: approvalRecord.id },
            data: { status: "pending" },
          }),
          db.booking.update({
            where: { id: bookingId },
            data: { bookingStatus: "Pending" },
          }),
        );
      }
    }

    const [agreement] = await db.$transaction(ops) as [Awaited<ReturnType<typeof db.clientAgreement.upsert>>, ...unknown[]];

    if (signedClientStep) {
      await logAudit({
        userId: session!.user.id,
        action: "client_agreement.regenerated",
        entityType: "booking",
        entityId: bookingId,
        description: "Link agreement di-generate ulang — tanda tangan client direset, booking kembali Pending",
        changes: { stepId: signedClientStep.id, stepOrder: signedClientStep.stepOrder },
      });
    }

    revalidateTag("bookings", "max");
    revalidateTag("approvals", "max");
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
    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[markAgreementSent]", e);
    return { success: false as const, error: "Gagal update status" };
  }
}
