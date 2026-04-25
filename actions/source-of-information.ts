"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createSourceOfInformation(name: string) {
  const { error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const item = await db.sourceOfInformation.create({ data: { name: parsed.data.trim() } });
    revalidateTag("source-of-informations", "max");
    return { success: true, item };
  } catch {
    return { success: false, error: "Nama sudah digunakan." };
  }
}

export async function updateSourceOfInformation(id: string, name: string) {
  const { error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const item = await db.sourceOfInformation.update({ where: { id }, data: { name: parsed.data.trim() } });
    revalidateTag("source-of-informations", "max");
    return { success: true, item };
  } catch {
    return { success: false, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteSourceOfInformation(id: string) {
  const { error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false, error };

  try {
    await db.sourceOfInformation.delete({ where: { id } });
    revalidateTag("source-of-informations", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menghapus." };
  }
}
