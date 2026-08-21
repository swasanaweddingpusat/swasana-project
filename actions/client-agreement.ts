"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { canAccessBooking, getProfileDataScope } from "@/lib/access-control";
import { logAudit } from "@/lib/audit";
import { generateAccessCode } from "@/lib/access-code";
import { isAllowedAgreementUploadMimeType } from "@/lib/validations/upload";

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

const uploadManualAgreementSchema = z.object({
  bookingId: z.string().min(1),
  path: z.string().min(1).refine((v) => v.startsWith("client-agreements/"), { message: "Key file tidak valid." }),
  fileName: z.string().min(1),
  fileType: z.string().refine(isAllowedAgreementUploadMimeType, { message: "Tipe file tidak diizinkan." }),
});

/**
 * Alternate way to complete the client approval step: instead of the client
 * signing digitally in-browser (api/client-agreement/sign), staff upload a
 * scan of a physically-signed PO on the client's behalf. Mirrors the sign
 * route's transaction logic closely — same revision-filtering, same "all
 * other steps approved → Confirmed" rule — just swaps the signature capture
 * for a file reference stored on the step's clientAgreementUploaded column.
 */
export async function uploadManualAgreement(input: {
  bookingId: string;
  path: string;
  fileName: string;
  fileType: string;
}) {
  const { session, error } = await requirePermission({ module: "booking", action: "client-agreement" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`manual-agreement:${session!.user.id}`)) {
    return { success: false as const, ...rateLimitError() };
  }

  const parsed = uploadManualAgreementSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
  const { bookingId, path, fileName, fileType } = parsed.data;

  const scope = await getProfileDataScope(session!.user.profileId);
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false as const, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    // Atomic claim: flip Pending/Sent/Viewed → Signed in ONE guarded write —
    // same rationale as api/client-agreement/sign/route.ts. This both prevents
    // a double-submit race AND is the mechanism that invalidates the digital
    // link (the public page treats status "Signed" as already-completed).
    const claim = await db.clientAgreement.updateMany({
      where: { bookingId, status: { not: "Signed" } },
      data: { status: "Signed", signedAt: new Date() },
    });
    if (claim.count === 0) {
      return { success: false as const, error: "Agreement sudah diselesaikan." };
    }

    // Read everything needed BEFORE writing, so the effect can commit as a
    // single atomic transaction (same shape as sign/route.ts).
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { currentRevisionId: true },
    });

    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.booking.update({
        where: { id: bookingId },
        data: { snapshotFrozenAt: new Date() },
      }),
    ];

    if (approvalRecord) {
      const allSteps = approvalRecord.steps;

      // Filter by currentRevisionId when available (snapshot approach).
      // Fallback for legacy bookings without currentRevisionId: use all steps
      // that have no revisionId (pre-snapshot data), or all steps if no
      // revisioned data exists.
      const currentRevisionId = booking?.currentRevisionId ?? null;
      const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);

      const revisionSteps = (currentRevisionId && hasRevisionedSteps)
        ? allSteps.filter((s) => s.revisionId === currentRevisionId)
        : allSteps;

      const clientStep = revisionSteps.find(
        (s) => s.approverType === "client" && s.status === "pending"
      );

      if (clientStep) {
        // All OTHER steps in this revision must be approved before confirming the booking.
        const allOtherApproved = revisionSteps
          .filter((s) => s.id !== clientStep.id)
          .every((s) => s.status === "approved");

        ops.push(
          db.approvalRecordStep.update({
            where: { id: clientStep.id },
            data: {
              status: "approved",
              clientAgreementUploaded: { path, fileName, fileType } as Prisma.InputJsonValue,
              decidedById: session!.user.profileId,
              decidedAt: new Date(),
            },
          }),
        );
        if (allOtherApproved) {
          ops.push(
            db.approvalRecord.update({
              where: { id: approvalRecord.id },
              data: { status: "approved" },
            }),
            db.booking.update({
              where: { id: bookingId },
              data: { bookingStatus: "Confirmed" },
            }),
          );
        }
      }
      // If clientStep not found (legacy booking without client step) — the
      // agreement is still marked Signed above. No crash; audit + return success.
    }

    // Single atomic commit: step + record + booking all-or-nothing (array form).
    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "client_agreement.manual_uploaded",
      entityType: "booking",
      entityId: bookingId,
      description: `PO manual diupload (${fileName})`,
    });

    revalidateTag("bookings", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[uploadManualAgreement]", e);
    return { success: false as const, error: "Gagal mengupload PO manual." };
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
