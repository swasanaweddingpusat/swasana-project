"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createComplimentarySchema,
  updateComplimentarySchema,
  type CreateComplimentaryInput,
  type UpdateComplimentaryInput,
} from "@/lib/validations/complimentary";

export async function createComplimentary(
  input: CreateComplimentaryInput
): Promise<{ success: boolean; item?: { id: string; name: string; price: number; isShowPrice: boolean; description: string | null }; error?: string }> {
  const { session, error } = await requirePermission({ module: "complimentary", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`complimentary-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createComplimentarySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.complimentary.create({
        data: {
          name: parsed.data.name.trim(),
          price: parsed.data.price,
          description: parsed.data.description?.trim() ?? null,
          isShowPrice: parsed.data.isShowPrice,
          isActive: parsed.data.isActive,
        },
        select: { id: true, name: true, price: true, isShowPrice: true, description: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "complimentary.created",
      entityType: "complimentary",
      entityId: item.id,
      changes: { name: item.name, price: item.price },
    });

    revalidateTag("complimentaries", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createComplimentary]", e);
    return { success: false, error: "Nama sudah digunakan atau terjadi kesalahan." };
  }
}

export async function updateComplimentary(
  id: string,
  input: UpdateComplimentaryInput
): Promise<{ success: boolean; item?: { id: string; name: string; price: number; isShowPrice: boolean; description: string | null; isActive: boolean }; error?: string }> {
  const { session, error } = await requirePermission({ module: "complimentary", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`complimentary-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateComplimentarySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() ?? null;
    if (parsed.data.isShowPrice !== undefined) updateData.isShowPrice = parsed.data.isShowPrice;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const [item] = await db.$transaction([
      db.complimentary.update({
        where: { id },
        data: updateData,
        select: { id: true, name: true, price: true, isShowPrice: true, description: true, isActive: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "complimentary.updated",
      entityType: "complimentary",
      entityId: id,
      changes: updateData,
    });

    revalidateTag("complimentaries", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updateComplimentary]", e);
    return { success: false, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteComplimentary(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "complimentary", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`complimentary-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.complimentary.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "complimentary.deleted",
      entityType: "complimentary",
      entityId: id,
      changes: {},
    });

    revalidateTag("complimentaries", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteComplimentary]", e);
    return { success: false, error: "Gagal menghapus. Item mungkin masih digunakan." };
  }
}
