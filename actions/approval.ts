"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { revalidateTag } from "next/cache";

export async function approveStep(stepId: string, signature: string) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false as const, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`approval:${session.user.id}`)) return { success: false as const, ...rateLimitError() };

  if (!signature) return { success: false as const, error: "Tanda tangan wajib diisi" };

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

    // Check previous steps are all approved
    const prevSteps = await db.approvalRecordStep.findMany({
      where: { recordId: step.recordId, stepOrder: { lt: step.stepOrder } },
    });
    const allPrevApproved = prevSteps.every((s) => s.status === "approved");
    if (!allPrevApproved) return { success: false as const, error: "Step sebelumnya belum disetujui" };

    const allSteps = await db.approvalRecordStep.findMany({ where: { recordId: step.recordId } });
    const allApproved = allSteps.every((s) => s.id === stepId ? true : s.status === "approved");

    await db.$transaction(async (tx) => {
      // Approve step
      await tx.approvalRecordStep.update({
        where: { id: stepId },
        data: { status: "approved", decidedById: session.user.profileId, decidedAt: new Date(), signature },
      });

      if (allApproved) {
        await tx.approvalRecord.update({ where: { id: step.recordId }, data: { status: "approved" } });
        if (step.record.module === "package") {
          await tx.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "approved" } });
        }
      }
    });

    const nextStep = allSteps.find((s) => s.stepOrder === step.stepOrder + 1 && s.status === "pending");
    if (nextStep) {
      await notifyApprover(nextStep, step.record.module, step.record.entityId);
    }
    await notifyCreator(step.record, `Step ${step.stepOrder} disetujui`, allApproved ? "approved" : undefined);

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");

    return { success: true as const };
  } catch (e) {
    console.error("[approveStep]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function rejectStep(stepId: string, notes: string) {
  const permResult = await requirePermission({ module: "package", action: "edit" });
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

    await db.$transaction(async (tx) => {
      // Reject step + record
      await tx.approvalRecordStep.update({
        where: { id: stepId },
        data: { status: "rejected", decidedById: session.user.profileId, decidedAt: new Date(), notes: notes.trim() },
      });
      await tx.approvalRecord.update({ where: { id: step.recordId }, data: { status: "rejected" } });

      if (step.record.module === "package") {
        await tx.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "rejected" } });
      }
    });

    await notifyCreator(step.record, `Ditolak: ${notes.trim()}`);

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");

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
  const superAdminRole = await db.role.findUnique({ where: { name: "Super Admin" }, select: { id: true } });
  if (superAdminRole && roleId === superAdminRole.id) return true;

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
