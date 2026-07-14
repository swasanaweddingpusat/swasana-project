import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveApprovalSteps } from "@/lib/approval-flows";

interface SessionUser {
  profileId: string | null | undefined;
  roleId: string | null | undefined;
}

/**
 * Build a list of PrismaPromise ops that reset an approved package's approval
 * back to pending and recreate all approval steps from the hardcoded flow.
 *
 * Returns an empty array if the flow cannot be resolved (e.g. roles missing in DB).
 * The caller MUST include these ops in a db.$transaction([...]) call.
 *
 * Note: module "package" does NOT use Peruri e-meterai — emateraiSn /
 * emateraiQrBase64 are intentionally left untouched (they remain null or
 * whatever was previously stored). Only status is reset; per-approver
 * signatures live on ApprovalRecordStep and are recreated below.
 */
export async function buildResetApprovalOps(
  packageId: string,
  session: SessionUser
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const [steps, existing] = await Promise.all([
    resolveApprovalSteps("package"),
    db.approvalRecord.findUnique({
      where: { module_entityId: { module: "package", entityId: packageId } },
      select: { id: true },
    }),
  ]);

  if (!steps || steps.length === 0) return [];

  const recordId = existing?.id ?? crypto.randomUUID();
  const now = new Date();
  const creatorRoleId = session.roleId;
  const creatorStepIdx = steps.findIndex(
    (s) => s.approverType === "role" && s.approverRoleId === creatorRoleId
  );
  // allAutoApproved: true only when every step index equals creatorStepIdx —
  // i.e. flow has exactly 1 step and creator's role matches that step.
  const allAutoApproved =
    steps.length > 0 && steps.every((_, i) => i === creatorStepIdx);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // 1. Delete existing steps
    db.approvalRecordStep.deleteMany({ where: { recordId } }),

    // 2. Reset (or create) the approval record
    existing
      ? db.approvalRecord.update({
          where: { id: existing.id },
          data: {
            status: "pending",
            updatedById: session.profileId ?? null,
          },
        })
      : db.approvalRecord.create({
          data: {
            id: recordId,
            module: "package",
            entityId: packageId,
            status: "pending",
            createdById: session.profileId!,
          },
        }),

    // 3. Recreate steps from hardcoded flow
    ...steps.map((step, i) => {
      // Auto-approve ONLY the step whose approverRoleId matches the editor's role.
      // If creatorStepIdx === -1, no step is auto-approved.
      const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
      return db.approvalRecordStep.create({
        data: {
          recordId,
          stepOrder: step.sortOrder,
          approverType: step.approverType,
          approverRoleId: step.approverRoleId,
          approverUserId: null,
          status: shouldAutoApprove ? "approved" : "pending",
          decidedById: shouldAutoApprove ? (session.profileId ?? null) : null,
          decidedAt: shouldAutoApprove ? now : null,
          signature: null, // no signature on reset
        },
      });
    }),

    // 4. Reset package approval status
    db.package.update({
      where: { id: packageId },
      data: { approvalStatus: "pending" },
    }),

    // 5. If all steps auto-approve (creator's role covers all steps), mark approved
    ...(allAutoApproved
      ? [
          db.approvalRecord.update({
            where: { id: recordId },
            data: { status: "approved" },
          }),
          db.package.update({
            where: { id: packageId },
            data: { approvalStatus: "approved" },
          }),
        ]
      : []),
  ];

  return ops;
}
