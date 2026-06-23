"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { updatePayrollSettingsSchema } from "@/lib/validations/payrollSettings";

export async function updatePayrollSettings(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-payroll", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`payroll-settings-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updatePayrollSettingsSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.payrollSettings.findFirst({ select: { id: true } });

    let settingsId: string;

    if (existing) {
      const updated = await db.payrollSettings.update({
        where: { id: existing.id },
        data: parsed.data,
      });
      settingsId = updated.id;
    } else {
      const created = await db.payrollSettings.create({ data: parsed.data });
      settingsId = created.id;
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "payroll-settings.update",
      entityType: "payroll-settings",
      entityId: settingsId,
      description: "Pengaturan payroll diperbarui",
    });

    revalidateTag("payroll-settings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updatePayrollSettings]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
