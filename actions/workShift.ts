"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createWorkShiftSchema, updateWorkShiftSchema } from "@/lib/validations/workShift";

export async function createWorkShift(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-shift-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createWorkShiftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const shift = await db.workShift.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_shift.create",
      entityType: "work_shift",
      entityId: shift.id,
      description: `Shift kerja "${shift.name}" dibuat`,
    });

    revalidateTag("work-shifts", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama shift kerja sudah digunakan." };
    }
    console.error("[createWorkShift]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateWorkShift(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-shift-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateWorkShiftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const shift = await db.workShift.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_shift.update",
      entityType: "work_shift",
      entityId: id,
      description: `Shift kerja "${shift.name}" diperbarui`,
    });

    revalidateTag("work-shifts", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama shift kerja sudah digunakan." };
    }
    console.error("[updateWorkShift]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteWorkShift(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-shift-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const shift = await db.workShift.findUnique({
      where: { id },
      select: { name: true, _count: { select: { assignments: true } } },
    });
    if (!shift) return { success: false, error: "Shift kerja tidak ditemukan." };
    if (shift._count.assignments > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus shift yang masih memiliki karyawan yang di-assign",
      };
    }

    await db.workShift.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_shift.delete",
      entityType: "work_shift",
      entityId: id,
      description: `Shift kerja "${shift.name}" dihapus`,
    });

    revalidateTag("work-shifts", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteWorkShift]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
