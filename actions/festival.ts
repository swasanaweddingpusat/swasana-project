"use server";

import { revalidateTag } from "next/cache";
import type { Festival } from "@prisma/client";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { deleteFromStorage } from "@/lib/storage";
import {
  createFestivalSchema,
  updateFestivalSchema,
  type CreateFestivalInput,
} from "@/lib/validations/festival";

type FestivalMutationResult =
  | { success: true; item: Festival }
  | { success: false; error: string };

type SimpleMutationResult = { success: true } | { success: false; error: string };

export async function createFestival(input: CreateFestivalInput): Promise<FestivalMutationResult> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`festival-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createFestivalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.festival.create({
        data: {
          name: parsed.data.name.trim(),
          description: parsed.data.description,
          backgroundImageKey: parsed.data.backgroundImageKey,
          barcodeBoxX: parsed.data.barcodeBoxX,
          barcodeBoxY: parsed.data.barcodeBoxY,
          barcodeBoxWidth: parsed.data.barcodeBoxWidth,
          barcodeBoxHeight: parsed.data.barcodeBoxHeight,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "festival.created",
      result: "success",
      entityType: "Festival",
      entityId: item.id,
    });

    revalidateTag("festivals", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createFestival]", e);
    return { success: false, error: "Nama sudah digunakan." };
  }
}

export async function updateFestival(id: string, input: unknown): Promise<FestivalMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-festival", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`festival-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateFestivalSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.festival.findUnique({ where: { id }, select: { backgroundImageKey: true } });
    if (!existing) return { success: false, error: "Festival tidak ditemukan." };

    const [item] = await db.$transaction([
      db.festival.update({
        where: { id },
        data: {
          name: parsed.data.name.trim(),
          description: parsed.data.description,
          backgroundImageKey: parsed.data.backgroundImageKey,
          barcodeBoxX: parsed.data.barcodeBoxX,
          barcodeBoxY: parsed.data.barcodeBoxY,
          barcodeBoxWidth: parsed.data.barcodeBoxWidth,
          barcodeBoxHeight: parsed.data.barcodeBoxHeight,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        },
      }),
    ]);

    // Best-effort: delete the old background image if it was replaced. Never
    // fail the mutation on a storage error.
    if (existing.backgroundImageKey && existing.backgroundImageKey !== parsed.data.backgroundImageKey) {
      await deleteFromStorage(existing.backgroundImageKey).catch((e) => {
        console.error("[updateFestival] failed to delete old background image", e);
      });
    }

    await logAudit({
      userId: session!.user.id,
      action: "festival.updated",
      result: "success",
      entityType: "Festival",
      entityId: item.id,
    });

    revalidateTag("festivals", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updateFestival]", e);
    return { success: false, error: "Nama sudah digunakan." };
  }
}

export async function deleteFestival(id: string): Promise<SimpleMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-festival", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`festival-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.festival.findUnique({ where: { id }, select: { backgroundImageKey: true } });
    if (!existing) return { success: false, error: "Festival tidak ditemukan." };

    await db.$transaction([db.festival.delete({ where: { id } })]);

    if (existing.backgroundImageKey) {
      await deleteFromStorage(existing.backgroundImageKey).catch((e) => {
        console.error("[deleteFestival] failed to delete background image", e);
      });
    }

    await logAudit({
      userId: session!.user.id,
      action: "festival.deleted",
      result: "success",
      entityType: "Festival",
      entityId: id,
    });

    revalidateTag("festivals", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteFestival]", e);
    return { success: false, error: "Gagal menghapus festival — mungkin masih dipakai oleh entri guestbook." };
  }
}
