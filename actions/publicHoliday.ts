"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { publicHolidaySchema } from "@/lib/validations/publicHoliday";

function toMidnightUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function createPublicHoliday(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = publicHolidaySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.publicHoliday.create({
        data: { date: toMidnightUTC(parsed.data.date), name: parsed.data.name },
      }),
    ]);
    revalidateTag("public-holidays", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createPublicHoliday]", e);
    return { success: false, error: "Tanggal sudah terdaftar sebagai hari libur." };
  }
}

export async function updatePublicHoliday(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = publicHolidaySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.publicHoliday.update({
        where: { id },
        data: { date: toMidnightUTC(parsed.data.date), name: parsed.data.name },
      }),
    ]);
    revalidateTag("public-holidays", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[updatePublicHoliday]", e);
    return { success: false, error: "Gagal memperbarui. Tanggal mungkin sudah digunakan." };
  }
}

export async function deletePublicHoliday(id: string) {
  const { session, error } = await requirePermission({ module: "settings-public-holiday", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ph-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.publicHoliday.delete({ where: { id } })]);
    revalidateTag("public-holidays", "max");
    return { success: true };
  } catch (e) {
    console.error("[deletePublicHoliday]", e);
    return { success: false, error: "Gagal menghapus." };
  }
}
