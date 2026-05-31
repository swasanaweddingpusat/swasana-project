"use server";

import { db } from "@/lib/db";
import { requirePermission, isSuperAdmin as isSuperAdminFn } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";

export async function approveStep(stepId: string, signature?: string | null) {
  const permResult = await requirePermission({ module: "approval", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`approval:${session.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    const step = await db.approvalRecordStep.findUnique({
      where: { id: stepId },
      include: { record: true },
    });
    if (!step) return { success: false as const, error: "Step tidak ditemukan" };
    if (step.status !== "pending") return { success: false as const, error: "Step sudah diproses" };

    // Check if this user can approve this step
    const canApprove = await checkApprover(step, session.user.profileId, session.user.roleId);
    if (!canApprove) return { success: false as const, error: "Anda tidak berhak approve step ini" };

    const allSteps = await db.approvalRecordStep.findMany({ where: { recordId: step.recordId }, orderBy: { stepOrder: "asc" } });

    // Super Admin: approve all pending non-client steps at once
    const isSuperAdmin = await isSuperAdminFn(session.user.roleId);

    const stepsToApprove = isSuperAdmin
      ? allSteps.filter((s) => s.status === "pending" && s.approverType !== "client")
      : [step];

    // Enforce step order: for non-super-admin, all steps with a lower stepOrder must
    // already be approved before the target step can be approved.
    if (!isSuperAdmin) {
      const blockedByPrior = allSteps.some(
        (s) => s.stepOrder < step.stepOrder && s.status !== "approved"
      );
      if (blockedByPrior) {
        return { success: false as const, error: "Langkah sebelumnya belum disetujui" };
      }
    }

    const allApprovedAfter = allSteps.every((s) =>
      stepsToApprove.some((a) => a.id === s.id) ? true : s.status === "approved"
    );

    const now = new Date();
    const stepUpdates: Prisma.PrismaPromise<unknown>[] = stepsToApprove.map((s) =>
      db.approvalRecordStep.update({
        where: { id: s.id },
        data: { status: "approved", decidedById: session.user.profileId, decidedAt: now, signature: signature ?? null },
      })
    );

    const recordUpdate: Prisma.PrismaPromise<unknown>[] = allApprovedAfter
      ? [db.approvalRecord.update({ where: { id: step.recordId }, data: { status: "approved" } })]
      : [];

    const entityUpdate: Prisma.PrismaPromise<unknown>[] = allApprovedAfter && step.record.module === "package"
      ? [db.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "approved" } })]
      : allApprovedAfter && step.record.module === "booking"
        ? [db.booking.update({ where: { id: step.record.entityId }, data: { bookingStatus: "Confirmed" } })]
        : [];

    await db.$transaction([...stepUpdates, ...recordUpdate, ...entityUpdate]);

    if (!allApprovedAfter) {
      const nextStep = allSteps.find((s) => s.status === "pending" && !stepsToApprove.some((a) => a.id === s.id));
      if (nextStep) {
        await notifyApprover(nextStep, step.record.module, step.record.entityId);
      }
    }
    await notifyCreator(step.record, isSuperAdmin ? `Semua step disetujui oleh ${session.user.name ?? "super-admin"}` : `Step ${step.stepOrder} disetujui oleh ${session.user.name ?? "approver"}`, allApprovedAfter ? "approved" : undefined);

    await logAudit({
      userId: session.user.profileId,
      action: "approval.approved",
      entityType: step.record.module,
      entityId: step.record.entityId,
      description: `Step ${step.stepOrder} disetujui oleh ${session.user.name ?? "approver"}${allApprovedAfter ? " — semua step approved" : ""}`,
      changes: { stepId, stepOrder: step.stepOrder, allApproved: allApprovedAfter },
    });

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");
    revalidateTag("bookings", "max");

    return { success: true as const };
  } catch (e) {
    console.error("[approveStep]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function rejectStep(stepId: string, notes: string) {
  const permResult = await requirePermission({ module: "approval", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`approval:${session.user.id}`)) return { success: false as const, ...rateLimitError() };

  if (!notes.trim()) return { success: false as const, error: "Alasan penolakan wajib diisi" };

  try {
    const step = await db.approvalRecordStep.findUnique({
      where: { id: stepId },
      include: { record: true },
    });
    if (!step) return { success: false as const, error: "Step tidak ditemukan" };
    if (step.status !== "pending") return { success: false as const, error: "Step sudah diproses" };

    const canApprove = await checkApprover(step, session.user.profileId, session.user.roleId);
    if (!canApprove) return { success: false as const, error: "Anda tidak berhak reject step ini" };

    const entityRejectUpdate: Prisma.PrismaPromise<unknown>[] = step.record.module === "package"
      ? [db.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "rejected" } })]
      : step.record.module === "booking"
        ? [db.booking.update({ where: { id: step.record.entityId }, data: { bookingStatus: "Rejected" } })]
        : [];

    await db.$transaction([
      db.approvalRecordStep.update({
        where: { id: stepId },
        data: { status: "rejected", decidedById: session.user.profileId, decidedAt: new Date(), notes: notes.trim() },
      }),
      db.approvalRecord.update({ where: { id: step.recordId }, data: { status: "rejected" } }),
      ...entityRejectUpdate,
    ]);

    await notifyCreator(step.record, `Ditolak oleh ${session.user.name ?? "approver"}: ${notes.trim()}`);

    await logAudit({
      userId: session.user.profileId,
      action: "approval.rejected",
      entityType: step.record.module,
      entityId: step.record.entityId,
      description: `Step ${step.stepOrder} ditolak oleh ${session.user.name ?? "approver"}: ${notes.trim()}`,
      changes: { stepId, stepOrder: step.stepOrder, notes: notes.trim() },
    });

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");
    revalidateTag("bookings", "max");

    return { success: true as const };
  } catch (e) {
    console.error("[rejectStep]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkApprover(
  step: { approverType: string; approverRoleId: string | null; approverUserId: string | null },
  profileId: string,
  roleId: string | null
): Promise<boolean> {
  // Super Admin can approve any step
  if (await isSuperAdminFn(roleId)) return true;

  if (step.approverType === "client") return false;
  if (step.approverType === "user") return step.approverUserId === profileId;
  if (step.approverType === "role") return step.approverRoleId === roleId;
  return false;
}

async function notifyCreator(
  record: { createdById: string; module: string; entityId: string },
  message: string,
  status?: string
) {
  let title = `Approval ${record.module}`;
  if (status === "approved") title = `${record.module} Disetujui`;

  await db.notification.create({
    data: {
      userId: record.createdById,
      title,
      message,
      type: status === "approved" ? "approval_approved" : "approval_update",
      entityType: record.module,
      entityId: record.entityId,
    },
  });
}

async function notifyApprover(
  step: { approverType: string; approverRoleId: string | null; approverUserId: string | null },
  module: string,
  entityId: string
) {
  const userIds: string[] = [];
  if (step.approverType === "user" && step.approverUserId) {
    userIds.push(step.approverUserId);
  } else if (step.approverType === "role" && step.approverRoleId) {
    const profiles = await db.profile.findMany({
      where: { roleId: step.approverRoleId, status: "active" },
      select: { id: true },
    });
    userIds.push(...profiles.map((p) => p.id));
  }

  for (const userId of userIds) {
    await db.notification.create({
      data: {
        userId,
        title: `Approval ${module} Menunggu`,
        message: `Ada ${module} baru yang membutuhkan persetujuan Anda`,
        type: "approval_pending",
        entityType: module,
        entityId,
      },
    });
  }
}
