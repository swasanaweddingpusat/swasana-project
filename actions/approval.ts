"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isSuperAdmin as isSuperAdminFn } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { isSequentialFlow } from "@/lib/approval-flows";

type ApprovalActionResult =
  | { success: true }
  | { success: false; error: string };

export async function approveStep(
  stepId: string,
  signature?: string | null,
): Promise<ApprovalActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan. Silakan login kembali." };
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

    // Enforce step order only for sequential flows (catering, decoration).
    // For order-independent flows (booking, booking-mice, package),
    // manager and finance can approve in any order — record becomes "approved"
    // only when ALL role steps are done.
    if (!isSuperAdmin && await isSequentialFlow(step.record.module)) {
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
        where: { id: s.id, status: "pending" },
        data: { status: "approved", decidedById: session.user.profileId, decidedAt: now, signature: signature ?? null },
      })
    );

    const recordUpdate: Prisma.PrismaPromise<unknown>[] = allApprovedAfter
      ? [db.approvalRecord.update({ where: { id: step.recordId }, data: { status: "approved" } })]
      : [];

    const entityUpdate: Prisma.PrismaPromise<unknown>[] = allApprovedAfter && (step.record.module === "package" || step.record.module === "package-mice")
      ? [db.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "approved" } })]
      : allApprovedAfter && (step.record.module === "booking" || step.record.module === "booking-mice")
        ? [db.booking.update({ where: { id: step.record.entityId }, data: { bookingStatus: "Confirmed" } })]
        : [];

    const notificationOps: Prisma.PrismaPromise<unknown>[] = [];
    if (!allApprovedAfter) {
      const nextStep = allSteps.find((candidate) =>
        candidate.status === "pending" && !stepsToApprove.some((approved) => approved.id === candidate.id),
      );
      if (nextStep) {
        const recipientIds = await getApproverProfileIds(nextStep);
        notificationOps.push(...recipientIds.map((userId) => db.notification.create({
          data: {
            userId,
            title: `Approval ${step.record.module} Menunggu`,
            message: `Ada ${step.record.module} baru yang membutuhkan persetujuan Anda`,
            type: "approval_pending",
            entityType: step.record.module,
            entityId: step.record.entityId,
          },
        })));
      }
    }

    const creatorMessage = isSuperAdmin
      ? `Semua step disetujui oleh ${session.user.name ?? "super-admin"}`
      : `Step ${step.stepOrder} disetujui oleh ${session.user.name ?? "approver"}`;

    await db.$transaction([
      ...stepUpdates,
      ...recordUpdate,
      ...entityUpdate,
      ...notificationOps,
      db.notification.create({
        data: {
          userId: step.record.createdById,
          title: allApprovedAfter ? `${step.record.module} Disetujui` : `Approval ${step.record.module}`,
          message: creatorMessage,
          type: allApprovedAfter ? "approval_approved" : "approval_update",
          entityType: step.record.module,
          entityId: step.record.entityId,
        },
      }),
      db.activityLog.create({
        data: {
          userId: session.user.profileId,
          action: "approval.approved",
          entityType: step.record.module,
          entityId: step.record.entityId,
          description: `Step ${step.stepOrder} disetujui oleh ${session.user.name ?? "approver"}${allApprovedAfter ? " — semua step approved" : ""}`,
          changes: { stepId, stepOrder: step.stepOrder, allApproved: allApprovedAfter },
        },
      }),
    ]);

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");
    revalidateTag("bookings", "max");
    revalidateTag("quotations", "max");

    return { success: true as const };
  } catch (e) {
    console.error("[approveStep]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function rejectStep(
  stepId: string,
  notes: string,
): Promise<ApprovalActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Sesi tidak ditemukan. Silakan login kembali." };
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

    const entityRejectUpdate: Prisma.PrismaPromise<unknown>[] = (step.record.module === "package" || step.record.module === "package-mice")
      ? [db.package.update({ where: { id: step.record.entityId }, data: { approvalStatus: "rejected" } })]
      : (step.record.module === "booking" || step.record.module === "booking-mice")
        ? [db.booking.update({ where: { id: step.record.entityId }, data: { bookingStatus: "Rejected" } })]
        : [];

    const rejectionMessage = `Ditolak oleh ${session.user.name ?? "approver"}: ${notes.trim()}`;
    await db.$transaction([
      db.approvalRecordStep.update({
        where: { id: stepId, status: "pending" },
        data: { status: "rejected", decidedById: session.user.profileId, decidedAt: new Date(), notes: notes.trim() },
      }),
      db.approvalRecord.update({ where: { id: step.recordId }, data: { status: "rejected" } }),
      ...entityRejectUpdate,
      db.notification.create({
        data: {
          userId: step.record.createdById,
          title: `Approval ${step.record.module}`,
          message: rejectionMessage,
          type: "approval_update",
          entityType: step.record.module,
          entityId: step.record.entityId,
        },
      }),
      db.activityLog.create({
        data: {
          userId: session.user.profileId,
          action: "approval.rejected",
          entityType: step.record.module,
          entityId: step.record.entityId,
          description: `Step ${step.stepOrder} ditolak oleh ${session.user.name ?? "approver"}: ${notes.trim()}`,
          changes: { stepId, stepOrder: step.stepOrder, notes: notes.trim() },
        },
      }),
    ]);

    revalidateTag("approvals", "max");
    revalidateTag("packages", "max");
    revalidateTag("bookings", "max");
    revalidateTag("quotations", "max");

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

async function getApproverProfileIds(
  step: { approverType: string; approverRoleId: string | null; approverUserId: string | null },
): Promise<string[]> {
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

  return userIds;
}
