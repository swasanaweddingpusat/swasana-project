"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createWorkAssignmentSchema,
  updateWorkAssignmentSchema,
  bulkCreateWorkAssignmentSchema,
} from "@/lib/validations/workAssignment";

export async function createWorkAssignment(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-assignment-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createWorkAssignmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const assignment = await db.employeeWorkAssignment.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_assignment.create",
      entityType: "work_assignment",
      entityId: assignment.id,
      description: `Penugasan kerja untuk karyawan "${assignment.profileId}" dibuat`,
    });

    revalidateTag("work-assignments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Karyawan sudah memiliki penugasan untuk lokasi dan shift yang sama." };
    }
    console.error("[createWorkAssignment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateWorkAssignment(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-assignment-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateWorkAssignmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const assignment = await db.employeeWorkAssignment.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_assignment.update",
      entityType: "work_assignment",
      entityId: id,
      description: `Penugasan kerja "${assignment.id}" diperbarui`,
    });

    revalidateTag("work-assignments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Karyawan sudah memiliki penugasan untuk lokasi dan shift yang sama." };
    }
    console.error("[updateWorkAssignment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteWorkAssignment(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-assignment-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const assignment = await db.employeeWorkAssignment.findUnique({ where: { id }, select: { id: true } });
    if (!assignment) return { success: false, error: "Penugasan kerja tidak ditemukan." };

    await db.employeeWorkAssignment.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_assignment.delete",
      entityType: "work_assignment",
      entityId: id,
      description: `Penugasan kerja "${id}" dihapus`,
    });

    revalidateTag("work-assignments", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteWorkAssignment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function bulkCreateWorkAssignment(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-assignment-bulk:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = bulkCreateWorkAssignmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { profileIds, workLocationId, workShiftId, isDefault, offdayDays, effectiveDate, endDate } = parsed.data;

  try {
    await db.$transaction(
      profileIds.map((profileId) =>
        db.employeeWorkAssignment.create({
          data: { profileId, workLocationId, workShiftId, isDefault, offdayDays, effectiveDate, endDate },
        })
      )
    );

    await logAudit({
      userId: session!.user.profileId,
      action: "work_assignment.bulk_create",
      entityType: "work_assignment",
      entityId: workLocationId,
      description: `Penugasan kerja bulk untuk ${profileIds.length} karyawan dibuat`,
    });

    revalidateTag("work-assignments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Beberapa karyawan sudah memiliki penugasan untuk lokasi dan shift yang sama." };
    }
    console.error("[bulkCreateWorkAssignment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
