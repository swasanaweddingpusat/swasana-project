"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { packageTypeCategoryFormSchema } from "@/lib/validations/package-type-category";
import type { PackageTypeCategoryItem } from "@/lib/queries/package-type-categories";

type MutationResult =
  | { success: true; item: PackageTypeCategoryItem }
  | { success: false; error: string };

export async function createPackageTypeCategory(data: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-package-category", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ptc-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = packageTypeCategoryFormSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const maxSort = await db.packageTypeCategory.aggregate({ _max: { sortOrder: true } });
    const [item] = await db.$transaction([
      db.packageTypeCategory.create({
        data: { ...parsed.data, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
        select: { id: true, name: true, code: true, isActive: true, sortOrder: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "package_type_category.created",
      entityType: "PackageTypeCategory",
      entityId: item.id,
      description: `Kategori paket "${item.name}" dibuat`,
    });

    revalidateTag("package-type-category", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createPackageTypeCategory]", e);
    return { success: false, error: "Nama atau kode sudah digunakan." };
  }
}

export async function updatePackageTypeCategory(id: string, data: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-package-category", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ptc-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = packageTypeCategoryFormSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.packageTypeCategory.update({
        where: { id },
        data: parsed.data,
        select: { id: true, name: true, code: true, isActive: true, sortOrder: true, createdAt: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "package_type_category.updated",
      entityType: "PackageTypeCategory",
      entityId: item.id,
      description: `Kategori paket "${item.name}" diperbarui`,
    });

    revalidateTag("package-type-category", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updatePackageTypeCategory]", e);
    return { success: false, error: "Gagal memperbarui. Nama atau kode mungkin sudah digunakan." };
  }
}

export async function deletePackageTypeCategory(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "settings-package-category", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ptc-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const [item] = await db.$transaction([db.packageTypeCategory.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.profileId,
      action: "package_type_category.deleted",
      entityType: "PackageTypeCategory",
      entityId: item.id,
      description: `Kategori paket "${item.name}" dihapus`,
    });

    revalidateTag("package-type-category", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePackageTypeCategory]", e);
    return { success: false, error: "Gagal menghapus." };
  }
}
