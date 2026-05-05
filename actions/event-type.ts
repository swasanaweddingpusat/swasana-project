"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const eventTypeSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  code: z.string().min(1, "Kode wajib diisi").max(10).transform((v) => v.trim().toUpperCase()),
});

export async function createEventType(data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-event-types", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`et-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = eventTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const maxSort = await db.eventType.aggregate({ _max: { sortOrder: true } });
    const [item] = await db.$transaction([
      db.eventType.create({ data: { ...parsed.data, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 } }),
    ]);
    revalidateTag("event-types", { expire: 0 });
    return { success: true, item };
  } catch (e) {
    console.error("[createEventType]", e);
    return { success: false, error: "Kode sudah digunakan." };
  }
}

export async function updateEventType(id: string, data: unknown) {
  const { session, error } = await requirePermission({ module: "settings-event-types", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`et-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = eventTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.eventType.update({ where: { id }, data: parsed.data }),
    ]);
    revalidateTag("event-types", { expire: 0 });
    return { success: true, item };
  } catch (e) {
    console.error("[updateEventType]", e);
    return { success: false, error: "Gagal memperbarui. Kode mungkin sudah digunakan." };
  }
}

export async function deleteEventType(id: string) {
  const { session, error } = await requirePermission({ module: "settings-event-types", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`et-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([db.eventType.delete({ where: { id } })]);
    revalidateTag("event-types", { expire: 0 });
    return { success: true };
  } catch (e) {
    console.error("[deleteEventType]", e);
    return { success: false, error: "Gagal menghapus." };
  }
}
