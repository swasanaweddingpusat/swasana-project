"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";

const stepSchema = z.object({
  sortOrder: z.number().int(),
  approverType: z.enum(["role", "user", "client"]),
  approverRoleId: z.string().nullable().optional(),
  approverUserId: z.string().nullable().optional(),
});

const upsertFlowSchema = z.object({
  module: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().default(true),
  steps: z.array(stepSchema),
});

export async function upsertApprovalFlow(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`approval-flow-upsert:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = upsertFlowSchema.safeParse(data);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const { module, name, active, steps } = parsed.data;

    const [flow] = await db.$transaction([db.approvalFlow.upsert({
      where: { module },
      create: {
        module,
        name,
        active,
        steps: { create: steps.map((s) => ({ sortOrder: s.sortOrder, approverType: s.approverType, approverRoleId: s.approverRoleId ?? null, approverUserId: s.approverUserId ?? null })) },
      },
      update: {
        name,
        active,
        steps: {
          deleteMany: {},
          create: steps.map((s) => ({ sortOrder: s.sortOrder, approverType: s.approverType, approverRoleId: s.approverRoleId ?? null, approverUserId: s.approverUserId ?? null })),
        },
      },
      include: {
        steps: {
          orderBy: { sortOrder: "asc" },
          include: {
            approverRole: { select: { id: true, name: true } },
            approverUser: { select: { id: true, fullName: true } },
          },
        },
      },
    })]);

    revalidateTag("approval-flows", "max");
    return { success: true as const, flow };
  } catch (e) {
    console.error("[upsertApprovalFlow]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function deleteApprovalFlow(id: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`approval-flow-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    await db.$transaction([db.approvalFlow.delete({ where: { id } })]);
    revalidateTag("approval-flows", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteApprovalFlow]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}
