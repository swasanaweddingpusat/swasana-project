"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createOrderStatus(name: string) {
  const { error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false as const, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const item = await db.orderStatus.create({ data: { name: parsed.data.trim() } });
    revalidateTag("order-statuses", "max");
    return { success: true as const, item };
  } catch {
    return { success: false as const, error: "Nama sudah digunakan." };
  }
}

export async function updateOrderStatus(id: string, name: string) {
  const { error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false as const, error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const item = await db.orderStatus.update({ where: { id }, data: { name: parsed.data.trim() } });
    revalidateTag("order-statuses", "max");
    return { success: true as const, item };
  } catch {
    return { success: false as const, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteOrderStatus(id: string) {
  const { error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false as const, error };

  try {
    await db.orderStatus.delete({ where: { id } });
    revalidateTag("order-statuses", "max");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Gagal menghapus. Status mungkin sedang digunakan." };
  }
}
