"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createBlacklistEntrySchema } from "@/lib/validations/blacklist";

// ─── Create Blacklist Entry ────────────────────────────────────────────────────

export async function createBlacklistEntry(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`blacklist-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createBlacklistEntrySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const entry = await db.blacklistEntry.create({
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email ?? null,
        phoneNumber: parsed.data.phoneNumber ?? null,
        reason: parsed.data.reason,
        blacklistedById: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "blacklist_entry.create",
      entityType: "blacklist_entry",
      entityId: entry.id,
      description: `"${entry.fullName}" ditambahkan ke blacklist`,
    });

    revalidateTag("blacklist-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[createBlacklistEntry]", e);
    return { success: false, error: "Gagal menambahkan ke blacklist." };
  }
}

// ─── Delete Blacklist Entry ────────────────────────────────────────────────────

export async function deleteBlacklistEntry(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`blacklist-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const entry = await db.blacklistEntry.findUnique({
      where: { id },
      select: { fullName: true },
    });
    if (!entry) return { success: false, error: "Data tidak ditemukan." };

    await db.blacklistEntry.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "blacklist_entry.delete",
      entityType: "blacklist_entry",
      entityId: id,
      description: `"${entry.fullName}" dihapus dari blacklist`,
    });

    revalidateTag("blacklist-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBlacklistEntry]", e);
    return { success: false, error: "Gagal menghapus data blacklist." };
  }
}
