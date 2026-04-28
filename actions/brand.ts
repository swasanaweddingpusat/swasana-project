"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const brandSchema = z.object({
  name: z.string().min(1, "Nama brand wajib diisi"),
  code: z.string().min(1, "Kode brand wajib diisi").max(20),
});

export async function createBrand(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`brand-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = brandSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [brand] = await db.$transaction([db.brand.create({ data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() } })]);
    revalidateTag("brands", "max");
    return { success: true, brand };
  } catch (e) {
    console.error("[createBrand]", e);
    return { success: false, error: "Kode brand sudah digunakan." };
  }
}

export async function updateBrand(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`brand-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = brandSchema.extend({ id: z.string().min(1) }).safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [brand] = await db.$transaction([db.brand.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name, code: parsed.data.code.toUpperCase() },
    })]);
    revalidateTag("brands", "max");
    return { success: true, brand };
  } catch (e) {
    console.error("[updateBrand]", e);
    return { success: false, error: "Kode brand sudah digunakan." };
  }
}

export async function deleteBrand(id: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`brand-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.brand.delete({ where: { id } })]);
    revalidateTag("brands", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBrand]", e);
    return { success: false, error: "Brand tidak dapat dihapus karena masih digunakan oleh venue." };
  }
}
