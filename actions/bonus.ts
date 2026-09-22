"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createBonusSchema,
  updateBonusSchema,
  type CreateBonusInput,
  type UpdateBonusInput,
} from "@/lib/validations/bonus";
import type { BonusItem } from "@/lib/queries/bonus";

const bonusSelect = {
  id: true,
  name: true,
  price: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createBonus(
  input: CreateBonusInput
): Promise<{ success: true; data: BonusItem } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "bonus", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`bonus-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createBonusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [data] = await db.$transaction([
      db.bonus.create({
        data: {
          name: parsed.data.name.trim(),
          price: parsed.data.price,
          description: parsed.data.description?.trim() ?? null,
          isActive: parsed.data.isActive,
        },
        select: bonusSelect,
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "bonus.created",
      entityType: "bonus",
      entityId: data.id,
      changes: { name: data.name, price: data.price },
    });

    revalidateTag("bonuses", "max");
    return { success: true, data };
  } catch (e) {
    console.error("[createBonus]", e);
    return { success: false, error: "Nama sudah digunakan atau terjadi kesalahan." };
  }
}

export async function updateBonus(
  id: string,
  input: UpdateBonusInput
): Promise<{ success: true; data: BonusItem } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "bonus", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`bonus-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateBonusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() ?? null;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const [data] = await db.$transaction([
      db.bonus.update({
        where: { id },
        data: updateData,
        select: bonusSelect,
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "bonus.updated",
      entityType: "bonus",
      entityId: id,
      changes: updateData,
    });

    revalidateTag("bonuses", "max");
    return { success: true, data };
  } catch (e) {
    console.error("[updateBonus]", e);
    return { success: false, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteBonus(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "bonus", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`bonus-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.bonus.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "bonus.deleted",
      entityType: "bonus",
      entityId: id,
      changes: {},
    });

    revalidateTag("bonuses", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBonus]", e);
    return { success: false, error: "Gagal menghapus. Item mungkin masih digunakan." };
  }
}
