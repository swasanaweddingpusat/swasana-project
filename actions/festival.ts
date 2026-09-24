"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createFestival(name: string) {
  const { session, error } = await requirePermission({ module: "guestbook", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`festival-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.festival.create({ data: { name: parsed.data.trim() } })]);
    revalidateTag("festivals", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createFestival]", e);
    return { success: false, error: "Nama sudah digunakan." };
  }
}
