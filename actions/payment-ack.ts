"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
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

    // 4. Build atomic ops array — find-or-create ApprovalRecord + approve + ack in one batch.
    //
    // Neon HTTP adapter supports the array form of db.$transaction([...]) only.
    // We resolve the existing record ID outside, then compose all writes into a
    // single atomic array so there is no window where TOP.ackStatus can be updated
    // without a matching ApprovalRecord/Step, or vice-versa.
    const existingRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "payment", entityId: topId } },
      select: { id: true },
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (existingRecord) {
      // Record exists: approve all pending steps + mark record approved
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
      // No existing record: create record + steps atomically using createMany
      // pattern that is compatible with Neon HTTP array-form transaction.
      // We use upsert so a concurrent call hitting the unique constraint on
      // module+entityId is handled gracefully instead of throwing.
      ops.push(
        db.approvalRecord.upsert({
          where: { module_entityId: { module: "payment", entityId: topId } },
          create: {
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
          update: {
            // Already exists from concurrent call: mark approved
            status: "approved",
            updatedById: profileId,
            steps: {
              updateMany: {
                where: { status: "pending" },
                data: { status: "approved", decidedById: profileId, decidedAt: now },
              },
            },
          },
        })
      );
    }

    // TOP ackStatus update — always included in the same atomic batch
    ops.push(
      db.termOfPayment.update({
        where: { id: topId },
        data: { ackStatus: "acknowledged", acknowledgedAt: now, acknowledgedById: profileId },
      }),
      db.activityLog.create({
        data: {
          userId: profileId,
          action: "payment.acknowledged",
          entityType: "term_of_payment",
          entityId: topId,
          description: `TOP ${topId} acknowledged oleh ${session!.user.name ?? "Finance"}`,
          changes: { topId, ackStatus: "acknowledged" } as never,
          result: "success",
        },
      })
    );

    await db.$transaction(ops);

    revalidateTag("ar-bookings", "max");
    revalidateTag("groups", "max");
    return { success: true };
  } catch (e) {
    console.error("[acknowledgePayment]", e);
    return { success: false, error: "Terjadi kesalahan saat acknowledge." };
  }
}
