"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createLeaveTypeSchema, updateLeaveTypeSchema } from "@/lib/validations/leaveType";

export async function createLeaveType(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-type-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createLeaveTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const lt = await db.leaveType.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_type.create",
      entityType: "leave_type",
      entityId: lt.id,
      description: `Jenis cuti "${lt.name}" dibuat`,
    });

    revalidateTag("leave-types", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama atau code jenis cuti sudah digunakan." };
    }
    console.error("[createLeaveType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateLeaveType(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-type-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateLeaveTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const lt = await db.leaveType.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_type.update",
      entityType: "leave_type",
      entityId: id,
      description: `Jenis cuti "${lt.name}" diperbarui`,
    });

    revalidateTag("leave-types", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama atau code jenis cuti sudah digunakan." };
    }
    console.error("[updateLeaveType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteLeaveType(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-type-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const lt = await db.leaveType.findUnique({
      where: { id },
      select: { name: true, isSystemType: true, _count: { select: { requests: true } } },
    });
    if (!lt) return { success: false, error: "Jenis cuti tidak ditemukan." };
    if (lt.isSystemType) return { success: false, error: "Jenis cuti sistem tidak bisa dihapus. Nonaktifkan saja." };
    if (lt._count.requests > 0) return { success: false, error: "Tidak bisa menghapus jenis cuti yang sudah memiliki pengajuan." };

    await db.leaveType.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_type.delete",
      entityType: "leave_type",
      entityId: id,
      description: `Jenis cuti "${lt.name}" dihapus`,
    });

    revalidateTag("leave-types", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteLeaveType]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
