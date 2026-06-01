"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(100),
});

export async function createCategory(
  name: string,
): Promise<{ success: true; category: { id: string; name: string } } | { success: false; error: string }> {
  const permResult = await requirePermission({ module: "package", action: "edit" });
  if (permResult.error) return { success: false, error: permResult.error };
  const session = permResult.session!;
  if (!mutationLimiter.check(`create-category:${session.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createCategorySchema.safeParse({ name });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const cleanName = parsed.data.name;

  try {
    // Case-insensitive dedup: reuse existing category if the name already exists.
    const existing = await db.category.findFirst({
      where: { name: { equals: cleanName, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (existing) return { success: true, category: existing };

    const maxSort = await db.category.aggregate({ _max: { sortOrder: true } });
    const category = await db.category.create({
      data: { name: cleanName, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
      select: { id: true, name: true },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "category.created",
      entityType: "Category",
      entityId: category.id,
      description: `Kategori "${cleanName}" dibuat`,
    });

    revalidateTag("categories", "max");
    return { success: true, category };
  } catch (e) {
    console.error("[createCategory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
