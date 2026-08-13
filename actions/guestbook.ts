"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createGuestbookEntrySchema, updateGuestbookEntrySchema } from "@/lib/validations/guestbook";

function generateGuestCode(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `GC-${yyyy}${mm}${dd}-${rand}`;
}

export async function createGuestbookEntry(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGuestbookEntrySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { checkInAt, ...rest } = parsed.data;
  const guestCode = generateGuestCode();

  try {
    const [entry] = await db.$transaction([
      db.guestbookEntry.create({
        data: {
          ...rest,
          guestCode,
          checkInAt: checkInAt ? new Date(checkInAt) : undefined,
          createdById: session!.user.profileId,
        },
        select: { id: true, visitorName: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.create",
      entityType: "GuestbookEntry",
      entityId: entry.id,
      description: `Created guestbook entry for "${entry.visitorName}"`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[createGuestbookEntry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function checkOutGuestbookEntry(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-checkout:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.guestbookEntry.findUnique({
      where: { id },
      select: { id: true, checkOutAt: true, visitorName: true },
    });

    if (!existing) return { success: false, error: "Data tidak ditemukan." };
    if (existing.checkOutAt) return { success: false, error: "Tamu sudah melakukan check-out." };

    await db.$transaction([
      db.guestbookEntry.update({
        where: { id },
        data: { checkOutAt: new Date() },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.checkout",
      entityType: "GuestbookEntry",
      entityId: id,
      description: `Checked out guestbook entry for "${existing.visitorName}"`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[checkOutGuestbookEntry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateGuestbookEntry(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateGuestbookEntrySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.guestbookEntry.findUnique({
      where: { id },
      select: { id: true, visitorName: true },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan." };

    await db.$transaction([
      db.guestbookEntry.update({
        where: { id },
        data: {
          visitStatus: parsed.data.visitStatus ?? undefined,
          notJoinReason: parsed.data.notJoinReason ?? undefined,
          notes: parsed.data.notes ?? undefined,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.update",
      entityType: "GuestbookEntry",
      entityId: id,
      description: `Updated guestbook entry for "${existing.visitorName}"`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateGuestbookEntry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
