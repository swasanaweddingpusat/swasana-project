"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { resolveApprovalSteps } from "@/lib/approval-flows";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const ackSchema = z.object({
  topId: z.string().min(1, "ID term of payment tidak valid"),
});

/**
 * Acknowledge a paid Term of Payment.
 *
 * Flow:
 * 1. Validate TOP exists, paymentStatus === "paid", ackStatus === "pending".
 * 2. Resolve approval flow for module "payment" (DB-driven, step 1 = Finance).
 * 3. Upsert ApprovalRecord module="payment" entityId=topId, mark all steps approved.
 * 4. Update TOP.ackStatus = "acknowledged" atomically.
 */
export async function acknowledgePayment(
  topId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { session, error } = await requirePermission({
    module: "finance-ar",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ack-payment:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = ackSchema.safeParse({ topId });
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };

  try {
    // 1. Load TOP
    const top = await db.termOfPayment.findUnique({
      where: { id: topId },
      select: { id: true, paymentStatus: true, ackStatus: true },
    });

    if (!top) return { success: false, error: "Term of Payment tidak ditemukan." };
    if (top.paymentStatus !== "paid")
      return { success: false, error: "Hanya TOP yang sudah paid yang bisa di-acknowledge." };
    if (top.ackStatus === "acknowledged")
      return { success: false, error: "TOP ini sudah di-acknowledge sebelumnya." };

    // 2. Resolve payment approval steps
    const steps = await resolveApprovalSteps("payment");
    if (!steps || steps.length === 0)
      return { success: false, error: "Konfigurasi approval flow 'payment' tidak ditemukan." };

    // 3. Verify caller can approve step 1
    const step1 = steps[0];
    const callerRoleId = session!.user.roleId;
    const isAdmin = await isSuperAdmin(callerRoleId);

    if (!isAdmin && step1.approverRoleId !== callerRoleId) {
      return {
        success: false,
        error: "Anda tidak berwenang melakukan acknowledgment untuk TOP ini.",
      };
    }

    const now = new Date();
    const profileId = session!.user.profileId;

    // 4. Find or create ApprovalRecord, then approve + ack in one transaction
    const existingRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "payment", entityId: topId } },
      select: { id: true },
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (existingRecord) {
      ops.push(
        db.approvalRecordStep.updateMany({
          where: { recordId: existingRecord.id, status: "pending" },
          data: { status: "approved", decidedById: profileId, decidedAt: now },
        }),
        db.approvalRecord.update({
          where: { id: existingRecord.id },
          data: { status: "approved", updatedById: profileId },
        })
      );
    } else {
      // Create record with steps — nested create is outside transaction but we immediately
      // include TOP update in same atomic batch. If the create fails, TOP won't be updated.
      // Using two-step approach: create record first, then batch the rest.
      const newRecord = await db.approvalRecord.create({
        data: {
          module: "payment",
          entityId: topId,
          status: "approved",
          createdById: profileId,
          updatedById: profileId,
          steps: {
            create: steps.map((s) => ({
              stepOrder: s.sortOrder,
              approverType: "role",
              approverRoleId: s.approverRoleId,
              status: "approved",
              decidedById: profileId,
              decidedAt: now,
            })),
          },
        },
        select: { id: true },
      });

      // Verify record was created — if this was already created concurrently,
      // the unique constraint on module+entityId will have caught it above.
      // The newRecord.id is valid at this point.
      void newRecord; // used for side effect (creation), ack proceeds below
    }

    // Always update TOP ackStatus in the transaction
    ops.push(
      db.termOfPayment.update({
        where: { id: topId },
        data: { ackStatus: "acknowledged", acknowledgedAt: now, acknowledgedById: profileId },
      })
    );

    if (ops.length > 0) {
      await db.$transaction(ops);
    }

    await logAudit({
      userId: profileId,
      action: "payment.acknowledged",
      entityType: "term_of_payment",
      entityId: topId,
      description: `TOP ${topId} acknowledged oleh ${session!.user.name ?? "Finance"}`,
      changes: { topId, ackStatus: "acknowledged" },
    });

    revalidateTag("ar-bookings", "max");
    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[acknowledgePayment]", e);
    return { success: false, error: "Terjadi kesalahan saat acknowledge." };
  }
}
