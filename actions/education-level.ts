"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createEducationLevel(name: string, order: number) {
  const { session, error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`edu-level-create:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.educationLevel.create({ data: { name: parsed.data.trim(), order } })]);
    revalidateTag("education-levels", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[createEducationLevel]", e);
    return { success: false as const, error: "Nama sudah digunakan." };
  }
}

export async function updateEducationLevel(id: string, name: string, order: number) {
  const { session, error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`edu-level-update:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.educationLevel.update({ where: { id }, data: { name: parsed.data.trim(), order } })]);
    revalidateTag("education-levels", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[updateEducationLevel]", e);
    return { success: false as const, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteEducationLevel(id: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`edu-level-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    await db.$transaction([db.educationLevel.delete({ where: { id } })]);
    revalidateTag("education-levels", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteEducationLevel]", e);
    return { success: false as const, error: "Gagal menghapus." };
  }
}
