"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

const brandSchema = z.object({
  name: z.string().min(1, "Nama brand wajib diisi"),
  code: z.string().min(1, "Kode brand wajib diisi").max(20),
});

export async function createBrand(data: unknown) {
  const { error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };

  const parsed = brandSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const brand = await db.brand.create({ data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() } });
    revalidateTag("brands", "max");
    return { success: true, brand };
  } catch {
    return { success: false, error: "Kode brand sudah digunakan." };
  }
}

export async function updateBrand(data: unknown) {
  const { error } = await requirePermission({ module: "settings", action: "update" });
  if (error) return { success: false, error };

  const parsed = brandSchema.extend({ id: z.string().min(1) }).safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const brand = await db.brand.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() },
    });
    revalidateTag("brands", "max");
    return { success: true, brand };
  } catch {
    return { success: false, error: "Kode brand sudah digunakan." };
  }
}

export async function deleteBrand(id: string) {
  const { error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false, error };

  try {
    await db.brand.delete({ where: { id } });
    revalidateTag("brands", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Brand tidak dapat dihapus karena masih digunakan oleh venue." };
  }
}
