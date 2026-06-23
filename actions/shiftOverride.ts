"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createShiftOverrideSchema, updateShiftOverrideSchema } from "@/lib/validations/shiftOverride";

export async function createShiftOverride(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`shift-override-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createShiftOverrideSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const override = await db.shiftOverride.create({
      data: { ...parsed.data, createdBy: session!.user.profileId },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "shift_override.create",
      entityType: "shift_override",
      entityId: override.id,
      description: `Override shift untuk karyawan "${override.profileId}" pada tanggal ${override.date.toISOString().slice(0, 10)} dibuat`,
    });

    revalidateTag("shift-overrides", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Karyawan sudah memiliki override shift untuk tanggal yang sama." };
    }
    console.error("[createShiftOverride]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateShiftOverride(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`shift-override-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateShiftOverrideSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const override = await db.shiftOverride.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "shift_override.update",
      entityType: "shift_override",
      entityId: id,
      description: `Override shift "${override.id}" diperbarui`,
    });

    revalidateTag("shift-overrides", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Karyawan sudah memiliki override shift untuk tanggal yang sama." };
    }
    console.error("[updateShiftOverride]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteShiftOverride(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`shift-override-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const override = await db.shiftOverride.findUnique({ where: { id }, select: { id: true } });
    if (!override) return { success: false, error: "Override shift tidak ditemukan." };

    await db.shiftOverride.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "shift_override.delete",
      entityType: "shift_override",
      entityId: id,
      description: `Override shift "${id}" dihapus`,
    });

    revalidateTag("shift-overrides", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteShiftOverride]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
