"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);
const sortOrderSchema = z.number().int().min(0).max(9999);

export async function createProspectStatus(name: string, sortOrder: number) {
  const { session, error } = await requirePermission({ module: "settings-prospect-status", action: "create" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`prospect-status-create:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
  const parsedSort = sortOrderSchema.safeParse(sortOrder);
  if (!parsedSort.success) return { success: false as const, error: "Urutan tidak valid." };

  try {
    const item = await db.prospectStatus.create({
      data: { name: parsed.data.trim(), sortOrder: parsedSort.data },
    });
    revalidateTag("prospect-statuses", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[createProspectStatus]", e);
    return { success: false as const, error: "Nama sudah digunakan." };
  }
}

export async function updateProspectStatus(id: string, name: string, sortOrder: number) {
  const { session, error } = await requirePermission({ module: "settings-prospect-status", action: "edit" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`prospect-status-update:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
  const parsedSort = sortOrderSchema.safeParse(sortOrder);
  if (!parsedSort.success) return { success: false as const, error: "Urutan tidak valid." };

  try {
    const item = await db.prospectStatus.update({
      where: { id },
      data: { name: parsed.data.trim(), sortOrder: parsedSort.data },
    });
    revalidateTag("prospect-statuses", "max");
    return { success: true as const, item };
  } catch (e) {
    console.error("[updateProspectStatus]", e);
    return { success: false as const, error: "Gagal memperbarui. Nama mungkin sudah digunakan." };
  }
}

export async function deleteProspectStatus(id: string) {
  const { session, error } = await requirePermission({ module: "settings-prospect-status", action: "delete" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`prospect-status-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  // Status yang masih dipakai entry guestbook tidak boleh hilang diam-diam —
  // relasinya SetNull, jadi entry akan kehilangan status tanpa peringatan.
  const used = await db.guestbookEntry.count({ where: { prospectStatusId: id } });
  if (used > 0) {
    return {
      success: false as const,
      error: `Tidak bisa dihapus — masih dipakai ${used} entry guestbook.`,
    };
  }

  try {
    await db.prospectStatus.delete({ where: { id } });
    revalidateTag("prospect-statuses", "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteProspectStatus]", e);
    return { success: false as const, error: "Gagal menghapus status." };
  }
}
