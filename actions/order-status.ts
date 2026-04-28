"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createOrderStatus(name: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`order-status-create:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.orderStatus.create({ data: { name: parsed.data.trim() } })]);
    revalidateTag("order-statuses", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[createOrderStatus]", e);
    return { success: false as const, error: "Nama sudah digunakan." };
  }
}

export async function updateOrderStatus(id: string, name: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "edit" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`order-status-update:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.orderStatus.update({ where: { id }, data: { name: parsed.data.trim() } })]);
    revalidateTag("order-statuses", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[updateOrderStatus]", e);
    return { success: false as const, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteOrderStatus(id: string) {
  const { session, error } = await requirePermission({ module: "settings", action: "delete" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`order-status-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    await db.$transaction([db.orderStatus.delete({ where: { id } })]);
    revalidateTag("order-statuses", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteOrderStatus]", e);
    return { success: false as const, error: "Gagal menghapus. Status mungkin sedang digunakan." };
  }
}
