"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createDailyReportSchema,
  updateDailyReportSchema,
} from "@/lib/validations/daily-report-manager";

export async function createDailyReport(
  data: unknown
): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const { session, error } = await requirePermission({
    module: "daily-report-manager",
    action: "create",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-report-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createDailyReportSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { reportDate, ...rest } = parsed.data;

  try {
    const [report] = await db.$transaction([
      db.dailyReport.create({
        data: {
          ...rest,
          reportDate: new Date(reportDate),
          submittedById: session!.user.profileId,
        },
        select: { id: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "daily_report.created",
      result: "success",
      entityType: "DailyReport",
      entityId: report.id,
      description: `Created daily report for group "${rest.groupId}" on ${reportDate}`,
    });

    revalidateTag("daily-report-manager", "max");
    return { success: true, data: { id: report.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        success: false,
        error: "Laporan untuk grup dan tanggal ini sudah ada.",
      };
    }
    console.error("[createDailyReport]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateDailyReport(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const { session, error } = await requirePermission({
    module: "daily-report-manager",
    action: "edit",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-report-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateDailyReportSchema.safeParse({ ...(data as object), id });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id: reportId, reportDate, ...rest } = parsed.data;

  try {
    const existing = await db.dailyReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan." };

    const [updated] = await db.$transaction([
      db.dailyReport.update({
        where: { id: reportId },
        data: {
          ...rest,
          ...(reportDate !== undefined && { reportDate: new Date(reportDate) }),
        },
        select: { id: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "daily_report.updated",
      result: "success",
      entityType: "DailyReport",
      entityId: updated.id,
      description: `Updated daily report "${reportId}"`,
    });

    revalidateTag("daily-report-manager", "max");
    return { success: true, data: { id: updated.id } };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        success: false,
        error: "Laporan untuk grup dan tanggal ini sudah ada.",
      };
    }
    console.error("[updateDailyReport]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteDailyReport(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({
    module: "daily-report-manager",
    action: "delete",
  });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-report-delete:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    const existing = await db.dailyReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return { success: false, error: "Data tidak ditemukan." };

    await db.$transaction([db.dailyReport.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.profileId,
      action: "daily_report.deleted",
      result: "success",
      entityType: "DailyReport",
      entityId: id,
      description: `Deleted daily report "${id}"`,
    });

    revalidateTag("daily-report-manager", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteDailyReport]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
