"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createEducationLevel(name: string, order: number) {
  const { error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false as const, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const item = await db.educationLevel.create({ data: { name: parsed.data.trim(), order } });
    revalidateTag("education-levels", "max");
    return { success: true as const, item };
  } catch {
    return { success: false as const, error: "Nama sudah digunakan." };
  }
}

export async function updateEducationLevel(id: string, name: string, order: number) {
  const { error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false as const, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const item = await db.educationLevel.update({ where: { id }, data: { name: parsed.data.trim(), order } });
    revalidateTag("education-levels", "max");
    return { success: true as const, item };
  } catch {
    return { success: false as const, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteEducationLevel(id: string) {
  const { error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false as const, error };

  try {
    await db.educationLevel.delete({ where: { id } });
    revalidateTag("education-levels", "max");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Gagal menghapus." };
  }
}
