"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createWorkLocationSchema, updateWorkLocationSchema } from "@/lib/validations/workLocation";

export async function createWorkLocation(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-location-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createWorkLocationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const location = await db.workLocation.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_location.create",
      entityType: "work_location",
      entityId: location.id,
      description: `Lokasi kerja "${location.name}" dibuat`,
    });

    revalidateTag("work-locations", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama lokasi kerja sudah digunakan." };
    }
    console.error("[createWorkLocation]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateWorkLocation(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-location-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateWorkLocationSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const location = await db.workLocation.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_location.update",
      entityType: "work_location",
      entityId: id,
      description: `Lokasi kerja "${location.name}" diperbarui`,
    });

    revalidateTag("work-locations", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama lokasi kerja sudah digunakan." };
    }
    console.error("[updateWorkLocation]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteWorkLocation(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-attendance", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`work-location-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const location = await db.workLocation.findUnique({
      where: { id },
      select: { name: true, _count: { select: { assignments: true } } },
    });
    if (!location) return { success: false, error: "Lokasi kerja tidak ditemukan." };
    if (location._count.assignments > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus lokasi yang masih memiliki karyawan yang di-assign",
      };
    }

    await db.workLocation.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "work_location.delete",
      entityType: "work_location",
      entityId: id,
      description: `Lokasi kerja "${location.name}" dihapus`,
    });

    revalidateTag("work-locations", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteWorkLocation]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
