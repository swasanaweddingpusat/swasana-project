"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { generateBalancesSchema, adjustBalanceSchema } from "@/lib/validations/leaveBalance";
import { calculateProrate, getAvailableBalance } from "@/lib/leave-helpers";

export async function generateLeaveBalances(
  data: unknown
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-balance-gen:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = generateBalancesSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { year } = parsed.data;

  try {
    const employees = await db.profile.findMany({
      where: { status: "active" },
      select: { id: true, joinDate: true },
    });

    const leaveTypes = await db.leaveType.findMany({
      where: { isActive: true, defaultQuota: { gt: 0 } },
      select: { id: true, defaultQuota: true, isCarryOver: true, carryOverMaxDays: true },
    });

    let created = 0;

    for (const emp of employees) {
      for (const lt of leaveTypes) {
        const totalDays = emp.joinDate
          ? calculateProrate(emp.joinDate, year, lt.defaultQuota)
          : lt.defaultQuota;

        let carryOverDays = 0;
        if (lt.isCarryOver) {
          const prevBalance = await db.leaveBalance.findUnique({
            where: {
              profileId_leaveTypeId_year: {
                profileId: emp.id,
                leaveTypeId: lt.id,
                year: year - 1,
              },
            },
            select: { totalDays: true, usedDays: true, carryOverDays: true, adjustmentDays: true },
          });
          if (prevBalance) {
            const remaining = getAvailableBalance(prevBalance);
            carryOverDays = lt.carryOverMaxDays
              ? Math.min(Math.max(remaining, 0), lt.carryOverMaxDays)
              : Math.max(remaining, 0);
          }
        }

        try {
          await db.leaveBalance.create({
            data: {
              profileId: emp.id,
              leaveTypeId: lt.id,
              year,
              totalDays,
              carryOverDays,
              usedDays: 0,
              adjustmentDays: 0,
            },
          });
          created++;
        } catch (createErr) {
          if (
            createErr instanceof Error &&
            "code" in createErr &&
            (createErr as { code: string }).code === "P2002"
          ) {
            continue;
          }
          throw createErr;
        }
      }
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_balance.generate",
      entityType: "leave_balance",
      entityId: String(year),
      description: `Saldo cuti tahun ${year} digenerate (${created} record)`,
    });

    revalidateTag("leave-balances", "max");
    return { success: true, message: `${created} saldo cuti berhasil digenerate untuk tahun ${year}.` };
  } catch (e) {
    console.error("[generateLeaveBalances]", e);
    return { success: false, error: "Terjadi kesalahan saat generate saldo." };
  }
}

export async function adjustLeaveBalance(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-balance-adjust:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = adjustBalanceSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const balance = await db.leaveBalance.findUnique({
      where: { id: parsed.data.balanceId },
      select: { id: true, adjustmentDays: true, profileId: true, leaveTypeId: true, year: true },
    });
    if (!balance) return { success: false, error: "Saldo tidak ditemukan." };

    await db.leaveBalance.update({
      where: { id: parsed.data.balanceId },
      data: { adjustmentDays: parsed.data.adjustmentDays },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_balance.adjust",
      entityType: "leave_balance",
      entityId: balance.id,
      description: `Adjustment saldo cuti: ${parsed.data.adjustmentDays} hari. Alasan: ${parsed.data.reason}`,
      changes: {
        before: { adjustmentDays: balance.adjustmentDays },
        after: { adjustmentDays: parsed.data.adjustmentDays },
      },
    });

    revalidateTag("leave-balances", "max");
    return { success: true };
  } catch (e) {
    console.error("[adjustLeaveBalance]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
