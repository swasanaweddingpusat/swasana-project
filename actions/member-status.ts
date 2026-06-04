"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama wajib diisi").max(100);

export async function createMemberStatus(name: string) {
  const { session, error } = await requirePermission({ module: "customers", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`member-status-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [item] = await db.$transaction([db.customerMemberStatus.create({ data: { name: parsed.data.trim() } })]);
    revalidateTag("member-statuses", "max");
    return { success: true, item };
  } catch (e) {
    console.error("[createMemberStatus]", e);
    return { success: false, error: "Nama sudah digunakan." };
  }
}
