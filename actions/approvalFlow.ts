"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { z } from "zod";

// ─── Validation schemas ───────────────────────────────────────────────────────

const updateFlowSchema = z.object({
  module: z.string().min(1),
  sequential: z.boolean(),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(1),
        approverRoleId: z.string().min(1),
        label: z.string().optional(),
      })
    )
    .min(1, "Minimal satu step diperlukan"),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Update (or create) an approval flow config + its steps.
 * Replaces ALL steps for the module atomically.
 */
export async function updateApprovalFlow(
  input: z.infer<typeof updateFlowSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const { session, error } = await requirePermission({
    module: "settings-role-permission",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`approval-flow:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateFlowSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };

  const { module, sequential, steps } = parsed.data;

  try {
    // Upsert flow config
    const existing = await db.approvalFlowConfig.findUnique({
      where: { module },
      select: { id: true },
    });

    if (existing) {
      // Replace steps: delete old, insert new in transaction
      await db.$transaction([
        db.approvalFlowConfig.update({
          where: { id: existing.id },
          data: { sequential },
        }),
        db.approvalFlowStep.deleteMany({
          where: { flowId: existing.id },
        }),
        ...steps.map((s) =>
          db.approvalFlowStep.create({
            data: {
              flowId: existing.id,
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              label: s.label ?? null,
            },
          })
        ),
      ]);

      await logAudit({
        userId: session!.user.profileId,
        action: "approval_flow.updated",
        entityType: "approval_flow_config",
        entityId: existing.id,
        description: `Updated approval flow for module: ${module}`,
        changes: { module, sequential, stepCount: steps.length },
      });
    } else {
      // Create new flow + steps
      const newFlow = await db.approvalFlowConfig.create({
        data: {
          module,
          sequential,
          label: null,
          steps: {
            create: steps.map((s) => ({
              stepOrder: s.stepOrder,
              approverRoleId: s.approverRoleId,
              label: s.label ?? null,
            })),
          },
        },
      });

      await logAudit({
        userId: session!.user.profileId,
        action: "approval_flow.created",
        entityType: "approval_flow_config",
        entityId: newFlow.id,
        description: `Created approval flow for module: ${module}`,
        changes: { module, sequential, stepCount: steps.length },
      });
    }

    revalidateTag("approval-flows", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateApprovalFlow]", e);
    return { success: false, error: "Terjadi kesalahan saat menyimpan." };
  }
}
