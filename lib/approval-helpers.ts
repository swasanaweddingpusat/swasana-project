import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

interface SessionUser {
  profileId: string | null | undefined;
  roleId: string | null | undefined;
}

/**
 * Build a list of PrismaPromise ops that reset an approved package's approval
 * back to pending and recreate all approval steps from the flow template.
 *
 * Returns an empty array if no approval flow exists for "package".
 * The caller MUST include these ops in a db.$transaction([...]) call.
 *
 * Note: module "package" does NOT use Peruri e-meterai — emateraiSn /
 * emateraiQrBase64 are intentionally left untouched (they remain null or
 * whatever was previously stored). Only status + signature are reset.
 */
export async function buildResetApprovalOps(
  packageId: string,
  session: SessionUser
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const [flow, existing] = await Promise.all([
    db.approvalFlow.findUnique({
      where: { module: "package" },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    }),
    db.approvalRecord.findUnique({
      where: { module_entityId: { module: "package", entityId: packageId } },
      select: { id: true },
    }),
  ]);

  if (!flow || flow.steps.length === 0) return [];

  const recordId = existing?.id ?? crypto.randomUUID();
  const now = new Date();
  const creatorRoleId = session.roleId;
  const creatorStepIdx = flow.steps.findIndex(
    (s) => s.approverType === "role" && s.approverRoleId === creatorRoleId
  );
  // allAutoApproved: true only when every step index equals creatorStepIdx —
  // i.e. flow has exactly 1 step and creator's role matches that step.
  const allAutoApproved =
    flow.steps.length > 0 && flow.steps.every((_, i) => i === creatorStepIdx);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    // 1. Delete existing steps
    db.approvalRecordStep.deleteMany({ where: { recordId } }),

    // 2. Reset (or create) the approval record
    existing
      ? db.approvalRecord.update({
          where: { id: existing.id },
          data: {
            status: "pending",
            signature: null,
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
            signature: null,
          },
        }),

    // 3. Recreate steps from flow template
    ...flow.steps.map((step, i) => {
      // Auto-approve ONLY the step whose approverRoleId matches the editor's role.
      // If creatorStepIdx === -1, no step is auto-approved.
      const shouldAutoApprove = creatorStepIdx >= 0 && i === creatorStepIdx;
      return db.approvalRecordStep.create({
        data: {
          recordId,
          stepOrder: step.sortOrder,
          approverType: step.approverType,
          approverRoleId: step.approverRoleId ?? null,
          approverUserId: step.approverUserId ?? null,
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
