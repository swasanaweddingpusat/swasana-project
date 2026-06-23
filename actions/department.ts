"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createDepartmentSchema, updateDepartmentSchema } from "@/lib/validations/department";

export async function createDepartment(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createDepartmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const createData = {
      ...parsed.data,
      parentId: parsed.data.parentId || null,
      headId: parsed.data.headId || null,
    };
    const dept = await db.department.create({ data: createData });

    await logAudit({
      userId: session!.user.profileId,
      action: "department.create",
      entityType: "department",
      entityId: dept.id,
      description: `Departemen "${dept.name}" dibuat`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama departemen sudah digunakan." };
    }
    console.error("[createDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateDepartment(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateDepartmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const updateData = {
      ...parsed.data,
      ...(parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId || undefined } : {}),
      ...(parsed.data.headId !== undefined ? { headId: parsed.data.headId || undefined } : {}),
    };
    const dept = await db.department.update({ where: { id }, data: updateData });

    await logAudit({
      userId: session!.user.profileId,
      action: "department.update",
      entityType: "department",
      entityId: id,
      description: `Departemen "${dept.name}" diperbarui`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama departemen sudah digunakan." };
    }
    console.error("[updateDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteDepartment(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-departments", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`dept-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const dept = await db.department.findUnique({
      where: { id },
      select: { name: true, _count: { select: { profiles: true } } },
    });
    if (!dept) return { success: false, error: "Departemen tidak ditemukan." };
    if (dept._count.profiles > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus departemen yang masih memiliki karyawan. Pindahkan karyawan terlebih dahulu.",
      };
    }

    await db.department.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "department.delete",
      entityType: "department",
      entityId: id,
      description: `Departemen "${dept.name}" dihapus`,
    });

    revalidateTag("departments", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteDepartment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
