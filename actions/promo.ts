"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createPromoSchema,
  updatePromoSchema,
  type CreatePromoInput,
  type UpdatePromoInput,
} from "@/lib/validations/promo";
import type { PromoProgramItem } from "@/lib/queries/promo";

type PromoResult =
  | { success: true; item: PromoProgramItem }
  | { success: false; error: string };

type DeleteResult =
  | { success: true }
  | { success: false; error: string };

export async function createPromo(input: CreatePromoInput): Promise<PromoResult> {
  const { session, error } = await requirePermission({ module: "promo", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`promo-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createPromoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.discountProgram.create({
        data: {
          name: parsed.data.name.trim(),
          isActive: parsed.data.isActive,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          minTransaction: parsed.data.minTransaction ?? null,
          periodStart: parsed.data.periodStart,
          periodEnd: parsed.data.periodEnd,
          eventEligibleStart: parsed.data.eventEligibleStart ?? null,
          eventEligibleEnd: parsed.data.eventEligibleEnd ?? null,
          quota: parsed.data.quota ?? null,
          description: parsed.data.description?.trim() ?? null,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          discountType: true,
          discountValue: true,
          minTransaction: true,
          periodStart: true,
          periodEnd: true,
          eventEligibleStart: true,
          eventEligibleEnd: true,
          quota: true,
          usedCount: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "promo.created",
      entityType: "DiscountProgram",
      entityId: item.id,
      changes: { name: item.name, discountType: item.discountType, discountValue: item.discountValue },
    });

    revalidateTag("promos", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createPromo]", e);
    return { success: false, error: "Gagal membuat program. Nama mungkin sudah digunakan." };
  }
}

export async function updatePromo(
  id: string,
  input: UpdatePromoInput
): Promise<PromoResult> {
  const { session, error } = await requirePermission({ module: "promo", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`promo-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updatePromoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.discountType !== undefined) updateData.discountType = parsed.data.discountType;
    if (parsed.data.discountValue !== undefined) updateData.discountValue = parsed.data.discountValue;
    if (parsed.data.minTransaction !== undefined) updateData.minTransaction = parsed.data.minTransaction ?? null;
    if (parsed.data.periodStart !== undefined) updateData.periodStart = parsed.data.periodStart;
    if (parsed.data.periodEnd !== undefined) updateData.periodEnd = parsed.data.periodEnd;
    if (parsed.data.eventEligibleStart !== undefined) updateData.eventEligibleStart = parsed.data.eventEligibleStart ?? null;
    if (parsed.data.eventEligibleEnd !== undefined) updateData.eventEligibleEnd = parsed.data.eventEligibleEnd ?? null;
    if (parsed.data.quota !== undefined) updateData.quota = parsed.data.quota ?? null;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() ?? null;

    const [item] = await db.$transaction([
      db.discountProgram.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          isActive: true,
          discountType: true,
          discountValue: true,
          minTransaction: true,
          periodStart: true,
          periodEnd: true,
          eventEligibleStart: true,
          eventEligibleEnd: true,
          quota: true,
          usedCount: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "promo.updated",
      entityType: "DiscountProgram",
      entityId: id,
      changes: updateData,
    });

    revalidateTag("promos", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updatePromo]", e);
    return { success: false, error: "Gagal memperbarui program." };
  }
}

export async function deletePromo(id: string): Promise<DeleteResult> {
  const { session, error } = await requirePermission({ module: "promo", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`promo-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.discountProgram.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "promo.deleted",
      entityType: "DiscountProgram",
      entityId: id,
      changes: {},
    });

    revalidateTag("promos", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePromo]", e);
    return { success: false, error: "Gagal menghapus program." };
  }
}
