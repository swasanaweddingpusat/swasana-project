"use server";

import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { canAccessBooking } from "@/lib/access-control";
import { revalidateTag } from "next/cache";
import { resolveApprovalSteps } from "@/lib/approval-flows";

type CategoryType = "catering" | "decoration";

/**
 * Approve a category PO step. Uses ApprovalRecord/Step pattern.
 * Auto-creates ApprovalRecord if not exists for this booking+category.
 */
export async function approveCategoryPO(
  bookingId: string,
  categoryType: CategoryType,
  _role: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`approve-po:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!signature) return { success: false, error: "Tanda tangan wajib diisi." };

  try {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true } });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    const scope = session!.user.dataScope ?? "own";
    if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    // Find or create ApprovalRecord for this category
    let record = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: categoryType, entityId: bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!record) {
      // Auto-create from hardcoded flow
      const flowSteps = await resolveApprovalSteps(categoryType);
      if (!flowSteps || flowSteps.length === 0) {
        return { success: false, error: `Approval flow untuk ${categoryType} tidak ditemukan.` };
      }

      record = await db.approvalRecord.create({
        data: {
          module: categoryType,
          entityId: bookingId,
          status: "pending",
          createdById: session!.user.profileId!,
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });

      for (const flowStep of flowSteps) {
        await db.approvalRecordStep.create({
          data: {
            recordId: record.id,
            stepOrder: flowStep.sortOrder,
            approverType: flowStep.approverType,
            approverRoleId: flowStep.approverRoleId,
            approverUserId: null,
            status: "pending",
          },
        });
      }

      // Re-fetch with steps
      record = await db.approvalRecord.findUnique({
        where: { id: record.id },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      })!;
      if (!record) return { success: false, error: "Gagal membuat approval record." };
    }

    // Find the pending step that matches user's role
    const userRoleId = session!.user.roleId;
    const pendingStep = record.steps.find(
      (s) => s.status === "pending" && s.approverType === "role" && s.approverRoleId === userRoleId
    );

    // Super-admin can approve any pending step
    const isSuperAdmin = session!.user.isSuperAdmin;

    const stepToApprove = pendingStep ?? (isSuperAdmin ? record.steps.find((s) => s.status === "pending") : null);
    if (!stepToApprove) return { success: false, error: "Tidak ada step yang bisa di-approve." };

    // Approve the step
    const allStepsAfter = record.steps.map((s) => s.id === stepToApprove.id ? "approved" : s.status);
    const allApproved = allStepsAfter.every((s) => s === "approved");

    await db.$transaction([
      db.approvalRecordStep.update({
        where: { id: stepToApprove.id },
        data: { status: "approved", decidedById: session!.user.profileId, decidedAt: new Date(), signature },
      }),
      ...(allApproved ? [db.approvalRecord.update({ where: { id: record.id }, data: { status: "approved" } })] : []),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: `booking.${categoryType}_approved`,
      entityType: "booking",
      entityId: bookingId,
      changes: { stepOrder: stepToApprove.stepOrder, categoryType },
      description: `Approved ${categoryType} PO step ${stepToApprove.stepOrder}`,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[approveCategoryPO]", e);
    return { success: false, error: "Gagal menyimpan approval." };
  }
}

/**
 * Get category approval status from ApprovalRecordStep.
 */
export async function getCategoryApprovals(
  bookingId: string,
  categoryType: CategoryType
): Promise<Record<string, { signature: string; userId: string; name: string; at: string } | null>> {
  try {
    const record = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: categoryType, entityId: bookingId } },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          include: {
            approverRole: { select: { name: true } },
            decidedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!record) return { finance: null, dirops: null, oprations: null };

    const result: Record<string, { signature: string; userId: string; name: string; at: string } | null> = {
      finance: null,
      dirops: null,
      oprations: null,
    };

    // Map role names to keys
    const roleKeyMap: Record<string, string> = {
      "finance": "finance",
      "direktur-operational": "dirops",
      "operational": "oprations",
    };

    for (const step of record.steps) {
      if (step.status === "approved" && step.approverRole?.name) {
        const key = roleKeyMap[step.approverRole.name];
        if (key) {
          result[key] = {
            signature: step.signature ?? "",
            userId: step.decidedBy?.id ?? "",
            name: step.decidedBy?.fullName ?? "",
            at: step.decidedAt?.toISOString() ?? "",
          };
        }
      }
    }

    return result;
  } catch (e) {
    console.error("[getCategoryApprovals]", e);
    return { finance: null, dirops: null, oprations: null };
  }
}
