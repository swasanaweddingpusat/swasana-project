"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createDailyActivitySegment(
  name: string,
): Promise<{ success: true; item: { id: string; name: string } } | { success: false; error: string }> {
  const { session, error } = await requirePermission({
    module: "settings-daily-activity-segment",
    action: "create",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`das-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([
      db.dailyActivitySegment.create({ data: { name: parsed.data.trim() } }),
    ]);
    revalidateTag("daily-activity-segments", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createDailyActivitySegment]", e);
    return { success: false, error: "Nama sudah digunakan." };
  }
}
