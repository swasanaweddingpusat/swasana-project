"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { updateAttendanceSchema, bulkDeleteAttendanceSchema } from "@/lib/validations/attendance";

export async function updateAttendance(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-update:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateAttendanceSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.attendance.findUnique({ where: { id }, select: { id: true, profileId: true, date: true } });
    if (!existing) return { success: false, error: "Data kehadiran tidak ditemukan." };

    const { clockInAt, clockOutAt, ...rest } = parsed.data;

    await db.attendance.update({
      where: { id },
      data: {
        ...rest,
        ...(clockInAt !== undefined ? { clockInAt: clockInAt ? new Date(clockInAt) : null } : {}),
        ...(clockOutAt !== undefined ? { clockOutAt: clockOutAt ? new Date(clockOutAt) : null } : {}),
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance.update",
      entityType: "attendance",
      entityId: id,
      description: `Data kehadiran karyawan "${existing.profileId}" tanggal ${existing.date.toISOString().slice(0, 10)} diperbarui`,
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateAttendance]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteAttendance(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.attendance.findUnique({ where: { id }, select: { id: true, profileId: true, date: true } });
    if (!existing) return { success: false, error: "Data kehadiran tidak ditemukan." };

    await db.attendance.delete({ where: { id } });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance.delete",
      entityType: "attendance",
      entityId: id,
      description: `Data kehadiran karyawan "${existing.profileId}" tanggal ${existing.date.toISOString().slice(0, 10)} dihapus`,
    });

    revalidateTag("attendance", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteAttendance]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteBulkAttendance(ids: unknown): Promise<{ success: boolean; error?: string; count?: number }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`attendance-bulk-delete:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = bulkDeleteAttendanceSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const result = await db.attendance.deleteMany({ where: { id: { in: parsed.data.ids } } });

    await logAudit({
      userId: session.user.profileId,
      action: "attendance.bulk_delete",
      entityType: "attendance",
      entityId: parsed.data.ids.join(","),
      description: `${result.count} data kehadiran dihapus`,
    });

    revalidateTag("attendance", "max");
    return { success: true, count: result.count };
  } catch (e) {
    console.error("[deleteBulkAttendance]", e);
    return { success: false, error: "Gagal menghapus data kehadiran." };
  }
}
