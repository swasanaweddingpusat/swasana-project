"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { grantHolidayTokenSchema, revokeHolidayTokenSchema } from "@/lib/validations/holidayToken";

export async function grantHolidayToken(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`holiday-token-grant:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = grantHolidayTokenSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const profile = await db.profile.findUnique({
      where: { id: parsed.data.profileId },
      select: { id: true, status: true },
    });
    if (!profile) return { success: false, error: "Karyawan tidak ditemukan." };

    const holiday = await db.publicHoliday.findUnique({
      where: { id: parsed.data.publicHolidayId },
      select: { id: true, name: true, isActive: true },
    });
    if (!holiday || !holiday.isActive) return { success: false, error: "Hari besar tidak ditemukan atau tidak aktif." };

    const existing = await db.holidayTokenGrant.findUnique({
      where: {
        profileId_publicHolidayId: {
          profileId: parsed.data.profileId,
          publicHolidayId: parsed.data.publicHolidayId,
        },
      },
      select: { id: true },
    });
    if (existing) return { success: false, error: "Karyawan ini sudah punya token untuk hari besar ini." };

    const grant = await db.holidayTokenGrant.create({
      data: {
        profileId: parsed.data.profileId,
        publicHolidayId: parsed.data.publicHolidayId,
        publicHolidayName: holiday.name,
        note: parsed.data.note ?? null,
        grantedBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "holiday_token.grant",
      entityType: "holiday_token_grant",
      entityId: grant.id,
      description: `Token hari besar "${holiday.name}" diberikan ke karyawan ${parsed.data.profileId}`,
    });

    revalidateTag("holiday-tokens", "max");
    revalidateTag("holiday-token-grants", "max");
    return { success: true };
  } catch (e) {
    console.error("[grantHolidayToken]", e);
    return { success: false, error: "Terjadi kesalahan saat memberikan token." };
  }
}

export async function revokeHolidayToken(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`holiday-token-revoke:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = revokeHolidayTokenSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const grant = await db.holidayTokenGrant.findUnique({ where: { id: parsed.data.grantId } });
    if (!grant) return { success: false, error: "Grant tidak ditemukan." };

    const activeUsage = await db.leaveRequest.findFirst({
      where: {
        profileId: grant.profileId,
        publicHolidayId: grant.publicHolidayId,
        status: { in: ["pending", "manager_approved", "approved"] },
      },
      select: { id: true },
    });
    if (activeUsage) return { success: false, error: "Token ini sudah diajukan/dipakai, tidak bisa dibatalkan." };

    await db.holidayTokenGrant.delete({ where: { id: parsed.data.grantId } });

    await logAudit({
      userId: session!.user.profileId,
      action: "holiday_token.revoke",
      entityType: "holiday_token_grant",
      entityId: parsed.data.grantId,
      description: `Token hari besar "${grant.publicHolidayName}" dibatalkan dari karyawan ${grant.profileId}`,
    });

    revalidateTag("holiday-tokens", "max");
    revalidateTag("holiday-token-grants", "max");
    return { success: true };
  } catch (e) {
    console.error("[revokeHolidayToken]", e);
    return { success: false, error: "Terjadi kesalahan saat membatalkan token." };
  }
}
