"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { canAccessGuestbookEntry, buildOwnerScopeWhere } from "@/lib/access-control";
import { createGuestbookEntrySchema, updateGuestbookEntrySchema, isBitrixSourceName } from "@/lib/validations/guestbook";
import { normalizePhoneId } from "@/lib/phone";
import { bitrixCall } from "@/lib/bitrix";
import { UF_ADS_URL } from "@/app/api/bitrix/deals/route";

// Anchored to UTC (not server-local time) so the typed wall-clock numbers survive the
// round-trip unchanged regardless of the server process's timezone — paired with the
// UTC getters in GuestbookDrawer's formatDateTimeForInput/formatDateForInput on the client.
function parseLocalDateTime(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;

  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.exec(value);
  if (!match) return new Date(value);

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

function parseLocalDateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;

  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) return new Date(value);

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

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

  if (parsed.data.sourceOfInformationId) {
    const source = await db.sourceOfInformation.findUnique({
      where: { id: parsed.data.sourceOfInformationId },
      select: { name: true },
    });
    if (isBitrixSourceName(source?.name) && !parsed.data.bitrixContactId?.trim()) {
      return { success: false, error: "Bitrix ID wajib diisi untuk sumber Bitrix." };
    }
  }

  const { checkInAt, scheduledAt, commitVisitDate, commitPayDate, proofFiles, ...rest } = parsed.data;
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
              proofFiles: (proofFiles ?? undefined) as Prisma.InputJsonValue | undefined,
              guestCode,
              checkInAt: checkInAt ? parseLocalDateTime(checkInAt) : undefined,
              scheduledAt: scheduledAt ? parseLocalDateTime(scheduledAt) : undefined,
              commitVisitDate: commitVisitDate ? parseLocalDateOnly(commitVisitDate) : undefined,
              commitPayDate: commitPayDate ? parseLocalDateOnly(commitPayDate) : undefined,
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

const ALLOWED_CHECKOUT_STATUS = new Set(["deal", "to_be_discuss", "lost"]);

export async function checkOutGuestbookEntry(
  id: string,
  visitStatus: "deal" | "to_be_discuss" | "lost"
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-checkout:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!ALLOWED_CHECKOUT_STATUS.has(visitStatus)) return { success: false, error: "Status checkout tidak valid." };

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
        data: { checkOutAt: new Date(), visitStatus },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.checkout",
      entityType: "GuestbookEntry",
      entityId: id,
      description: `Checked out guestbook entry for "${existing.visitorName}" as ${visitStatus}`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[checkOutGuestbookEntry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export interface ConfirmAttendanceResult {
  success: boolean;
  error?: string;
  visitorName?: string;
  companyName?: string | null;
  alreadyConfirmed?: boolean;
  confirmedAt?: string;
}

export async function confirmGuestbookAttendance(guestCode: string): Promise<ConfirmAttendanceResult> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-confirm-attendance:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const code = guestCode.trim();
  if (!code) return { success: false, error: "Kode tidak valid." };

  try {
    const existing = await db.guestbookEntry.findUnique({
      where: { guestCode: code },
      select: { id: true, visitorName: true, companyName: true, attendanceConfirmedAt: true },
    });
    if (!existing) return { success: false, error: "Kode tidak ditemukan." };

    if (existing.attendanceConfirmedAt) {
      return {
        success: true,
        alreadyConfirmed: true,
        visitorName: existing.visitorName,
        companyName: existing.companyName,
        confirmedAt: existing.attendanceConfirmedAt.toISOString(),
      };
    }

    const now = new Date();
    await db.$transaction([
      db.guestbookEntry.update({
        where: { id: existing.id },
        data: { attendanceConfirmedAt: now, attendanceConfirmedById: session!.user.profileId, visitStatus: "done_visit" },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.confirm_attendance",
      entityType: "GuestbookEntry",
      entityId: existing.id,
      description: `Confirmed expo attendance for "${existing.visitorName}"`,
    });

    revalidateTag("guestbook-entries", "max");
    return {
      success: true,
      alreadyConfirmed: false,
      visitorName: existing.visitorName,
      companyName: existing.companyName,
      confirmedAt: now.toISOString(),
    };
  } catch (e) {
    console.error("[confirmGuestbookAttendance]", e);
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
      select: { id: true, visitorName: true, sourceOfInformationId: true, bitrixContactId: true },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan." };

    const effectiveSourceId =
      parsed.data.sourceOfInformationId !== undefined ? parsed.data.sourceOfInformationId : existing.sourceOfInformationId;
    const effectiveBitrixContactId =
      parsed.data.bitrixContactId !== undefined ? parsed.data.bitrixContactId : existing.bitrixContactId;

    if (effectiveSourceId) {
      const source = await db.sourceOfInformation.findUnique({
        where: { id: effectiveSourceId },
        select: { name: true },
      });
      if (isBitrixSourceName(source?.name) && !effectiveBitrixContactId?.trim()) {
        return { success: false, error: "Bitrix ID wajib diisi untuk sumber Bitrix." };
      }
    }

    const { checkInAt, checkOutAt, scheduledAt, commitVisitDate, commitPayDate, phoneNumber, proofFiles, ...rest } = parsed.data;
    // Recompute the normalized index whenever phoneNumber is part of the payload —
    // otherwise phoneNumberNorm goes stale after an edit (bitrix/duplicate matching).
    const phoneNumberNorm = phoneNumber !== undefined ? normalizePhoneId(phoneNumber) : undefined;

    await db.$transaction([
      db.guestbookEntry.update({
        where: { id },
        data: {
          ...rest,
          proofFiles: (proofFiles ?? undefined) as Prisma.InputJsonValue | undefined,
          phoneNumber,
          phoneNumberNorm,
          checkInAt: checkInAt ? parseLocalDateTime(checkInAt) : undefined,
          checkOutAt: checkOutAt ? parseLocalDateTime(checkOutAt) : undefined,
          scheduledAt: scheduledAt ? parseLocalDateTime(scheduledAt) : undefined,
          commitVisitDate: commitVisitDate ? parseLocalDateOnly(commitVisitDate) : undefined,
          commitPayDate: commitPayDate ? parseLocalDateOnly(commitPayDate) : undefined,
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

export async function deleteGuestbookEntry(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

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
      db.guestbookEntry.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.delete",
      entityType: "GuestbookEntry",
      entityId: id,
      description: `Deleted guestbook entry for "${existing.visitorName}"`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteGuestbookEntry]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteBulkGuestbookEntries(
  ids: string[]
): Promise<{ success: boolean; error?: string; count?: number }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-bulk-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const uniqueIds = Array.from(new Set(ids)).filter((id) => typeof id === "string" && id.trim().length > 0);
  if (uniqueIds.length === 0) return { success: false, error: "Tidak ada data yang dipilih." };
  if (uniqueIds.length > 100) return { success: false, error: "Maksimal 100 data sekaligus." };

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope ?? "own";
  const scopeWhere = await buildOwnerScopeWhere(session!.user.profileId, scope, "salesId");

  try {
    const accessible = await db.guestbookEntry.findMany({
      where: { id: { in: uniqueIds }, ...scopeWhere },
      select: { id: true },
    });
    if (accessible.length === 0) return { success: false, error: "Tidak ada data yang bisa dihapus." };

    const accessibleIds = accessible.map((e) => e.id);

    await db.$transaction([db.guestbookEntry.deleteMany({ where: { id: { in: accessibleIds } } })]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.bulk_delete",
      entityType: "GuestbookEntry",
      entityId: accessibleIds.join(","),
      description: `Bulk deleted ${accessibleIds.length} guestbook entries`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true, count: accessibleIds.length };
  } catch (e) {
    console.error("[deleteBulkGuestbookEntries]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function bulkCheckOutGuestbookEntries(
  ids: string[],
  visitStatus: "deal" | "to_be_discuss" | "lost"
): Promise<{ success: boolean; error?: string; count?: number }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-bulk-checkout:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  if (!ALLOWED_CHECKOUT_STATUS.has(visitStatus)) return { success: false, error: "Status checkout tidak valid." };

  const uniqueIds = Array.from(new Set(ids)).filter((id) => typeof id === "string" && id.trim().length > 0);
  if (uniqueIds.length === 0) return { success: false, error: "Tidak ada data yang dipilih." };
  if (uniqueIds.length > 100) return { success: false, error: "Maksimal 100 data sekaligus." };

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope ?? "own";
  const scopeWhere = await buildOwnerScopeWhere(session!.user.profileId, scope, "salesId");

  try {
    const accessible = await db.guestbookEntry.findMany({
      where: { id: { in: uniqueIds }, ...scopeWhere },
      select: { id: true, checkOutAt: true },
    });
    if (accessible.length === 0) return { success: false, error: "Tidak ada data yang bisa di-checkout." };

    const processableIds = accessible.filter((e) => !e.checkOutAt).map((e) => e.id);
    if (processableIds.length === 0) return { success: false, error: "Tidak ada data yang bisa di-checkout." };

    await db.$transaction([
      db.guestbookEntry.updateMany({
        where: { id: { in: processableIds } },
        data: { checkOutAt: new Date(), visitStatus },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "guestbook_entry.bulk_checkout",
      entityType: "GuestbookEntry",
      entityId: processableIds.join(","),
      description: `Bulk checked out ${processableIds.length} guestbook entries as ${visitStatus}`,
    });

    revalidateTag("guestbook-entries", "max");
    return { success: true, count: processableIds.length };
  } catch (e) {
    console.error("[bulkCheckOutGuestbookEntries]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function refreshGuestbookAdsUrl(
  id: string
): Promise<{ success: boolean; error?: string; adsUrl?: string | null }> {
  const { session, error } = await requirePermission({ module: "guestbook", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`guestbook-refresh-ads-url:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope ?? "own";
  if (!(await canAccessGuestbookEntry(session!.user.profileId, scope, id))) {
    return { success: false, error: "Anda tidak memiliki akses ke data ini." };
  }

  try {
    const existing = await db.guestbookEntry.findUnique({
      where: { id },
      select: { id: true, bitrixContactId: true, bitrixAdsUrl: true },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan." };
    if (!existing.bitrixContactId?.trim() || existing.bitrixAdsUrl?.trim()) {
      return { success: true, adsUrl: existing.bitrixAdsUrl };
    }

    const { result } = await bitrixCall<{ [key: string]: string | null | undefined }>("crm.deal.get", {
      id: existing.bitrixContactId,
    });
    const adsUrl = result?.[UF_ADS_URL]?.trim() || null;
    if (!adsUrl) return { success: true, adsUrl: null };

    await db.$transaction([db.guestbookEntry.update({ where: { id }, data: { bitrixAdsUrl: adsUrl } })]);

    // Silent background enrichment (fires on every qualifying drawer open) — no logAudit
    // here to avoid flooding the audit log with a non user-initiated sync.
    revalidateTag("guestbook-entries", "max");
    return { success: true, adsUrl };
  } catch (e) {
    console.error("[refreshGuestbookAdsUrl]", e);
    return { success: false, error: "Gagal memperbarui URL iklan Bitrix." };
  }
}
