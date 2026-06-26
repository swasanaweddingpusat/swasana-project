"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createPositionSchema, updatePositionSchema } from "@/lib/validations/position";

export async function createPosition(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createPositionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const pos = await db.position.create({ data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "position.create",
      entityType: "position",
      entityId: pos.id,
      description: `Posisi "${pos.name}" dibuat`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama posisi sudah digunakan." };
    }
    console.error("[createPosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updatePosition(id: string, data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updatePositionSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const pos = await db.position.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "position.update",
      entityType: "position",
      entityId: id,
      description: `Posisi "${pos.name}" diperbarui`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Nama posisi sudah digunakan." };
    }
    console.error("[updatePosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deletePosition(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-positions", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`pos-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const pos = await db.position.findUnique({
      where: { id },
      select: { name: true, _count: { select: { profiles: true } } },
    });
    if (!pos) return { success: false, error: "Posisi tidak ditemukan." };
    if (pos._count.profiles > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus posisi yang masih memiliki karyawan. Pindahkan karyawan terlebih dahulu.",
      };
    }

    await db.position.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "position.delete",
      entityType: "position",
      entityId: id,
      description: `Posisi "${pos.name}" dihapus`,
    });

    revalidateTag("positions", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePosition]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
