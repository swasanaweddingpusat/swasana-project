"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessGuestbookEntry } from "@/lib/access-control";
import { createGuestbookEntrySchema, updateGuestbookEntrySchema } from "@/lib/validations/guestbook";
import { normalizePhoneId } from "@/lib/phone";

function generateGuestCode(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `GC-${yyyy}${mm}${dd}-${rand}`;
}

export async function createGuestbookEntry(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createGuestbookEntrySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { checkInAt, scheduledAt, ...rest } = parsed.data;
  // Fase 3 attribution: the "Bertemu Dengan" picker feeds the sales met
  // (client_visit walk-in). Fall back to the creator (front-desk / self-log)
  // when no host is chosen — keeps online_meeting / jemput_bola attributed to
  // whoever logged it, matching the Fase 1 default.
  const salesId = rest.hostId ?? session!.user.profileId;
  const phoneNumberNorm = normalizePhoneId(rest.phoneNumber);

  try {
    const MAX_GUEST_CODE_ATTEMPTS = 5;
    let entry: { id: string; visitorName: string } | null = null;

    for (let attempt = 0; attempt < MAX_GUEST_CODE_ATTEMPTS; attempt++) {
      const guestCode = generateGuestCode();
      try {
        const [created] = await db.$transaction([
          db.guestbookEntry.create({
            data: {
              ...rest,
              guestCode,
              checkInAt: checkInAt ? new Date(checkInAt) : undefined,
              scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
              createdById: session!.user.profileId,
              salesId,
              phoneNumberNorm,
            },
            select: { id: true, visitorName: true },
          }),
        ]);
        entry = created;
        break;
      } catch (e) {
        const isGuestCodeCollision =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (isGuestCodeCollision && attempt < MAX_GUEST_CODE_ATTEMPTS - 1) continue;
        throw e;
      }
    }

    if (!entry) return { success: false, error: "Terjadi kesalahan." };

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

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessGuestbookEntry(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke data ini." };
  }

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

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessGuestbookEntry(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke data ini." };
  }

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
