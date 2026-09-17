"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import {
  createDailyActivitySchema,
  updateDailyActivitySchema,
  type CreateDailyActivityInput,
  type UpdateDailyActivityInput,
} from "@/lib/validations/daily-activity";

type ActionResult = { success: boolean; id?: string; error?: string };

/** Normalize an optional/empty string form value to a trimmed string or null. */
function orNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createDailyActivity(
  input: CreateDailyActivityInput,
): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "daily-activity", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-activity-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createDailyActivitySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const d = parsed.data;

  try {
    const [item] = await db.$transaction([
      db.dailyActivity.create({
        data: {
          salesId: d.salesId,
          activityDate: new Date(d.activityDate),
          companyName: orNull(d.companyName),
          segmentId: d.segmentId,
          sourceOfInformationId: d.sourceOfInformationId,
          sourceOfInformationDetail: orNull(d.sourceOfInformationDetail),
          milestone: d.milestone.trim(),
          progressStatus: d.progressStatus,
          bitrixId: orNull(d.bitrixId),
          contactName: orNull(d.contactName),
          phoneNumber: orNull(d.phoneNumber),
          email: orNull(d.email),
          location: orNull(d.location),
          siteVisitAt: d.siteVisitAt ? new Date(d.siteVisitAt) : null,
          notes: orNull(d.notes),
        },
        select: { id: true, companyName: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "daily-activity.created",
      entityType: "DailyActivity",
      entityId: item.id,
      changes: { companyName: item.companyName },
    });

    revalidateTag("daily-activity", "max");
    return { success: true, id: item.id };
  } catch (e) {
    console.error("[createDailyActivity]", e);
    return { success: false, error: "Gagal menyimpan daily activity." };
  }
}

export async function updateDailyActivity(
  id: string,
  input: UpdateDailyActivityInput,
): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "daily-activity", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-activity-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateDailyActivitySchema.safeParse({ ...input, id });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (d.salesId !== undefined) updateData.salesId = d.salesId;
  if (d.activityDate !== undefined) updateData.activityDate = new Date(d.activityDate);
  if (d.companyName !== undefined) updateData.companyName = orNull(d.companyName);
  if (d.segmentId !== undefined) updateData.segmentId = d.segmentId;
  if (d.sourceOfInformationId !== undefined) updateData.sourceOfInformationId = d.sourceOfInformationId;
  if (d.sourceOfInformationDetail !== undefined) updateData.sourceOfInformationDetail = orNull(d.sourceOfInformationDetail);
  if (d.milestone !== undefined) updateData.milestone = d.milestone.trim();
  if (d.progressStatus !== undefined) updateData.progressStatus = d.progressStatus;
  if (d.bitrixId !== undefined) updateData.bitrixId = orNull(d.bitrixId);
  if (d.contactName !== undefined) updateData.contactName = orNull(d.contactName);
  if (d.phoneNumber !== undefined) updateData.phoneNumber = orNull(d.phoneNumber);
  if (d.email !== undefined) updateData.email = orNull(d.email);
  if (d.location !== undefined) updateData.location = orNull(d.location);
  if (d.siteVisitAt !== undefined) updateData.siteVisitAt = d.siteVisitAt ? new Date(d.siteVisitAt) : null;
  if (d.notes !== undefined) updateData.notes = orNull(d.notes);

  try {
    const [item] = await db.$transaction([
      db.dailyActivity.update({
        where: { id },
        data: updateData,
        select: { id: true, companyName: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "daily-activity.updated",
      entityType: "DailyActivity",
      entityId: id,
      changes: updateData,
    });

    revalidateTag("daily-activity", "max");
    return { success: true, id: item.id };
  } catch (e) {
    console.error("[updateDailyActivity]", e);
    return { success: false, error: "Gagal memperbarui daily activity." };
  }
}

export async function deleteDailyActivity(id: string): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "daily-activity", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`daily-activity-delete:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    // Soft delete — set deletedAt; list queries filter on deletedAt: null.
    await db.$transaction([
      db.dailyActivity.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "daily-activity.deleted",
      entityType: "DailyActivity",
      entityId: id,
      changes: {},
    });

    revalidateTag("daily-activity", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteDailyActivity]", e);
    return { success: false, error: "Gagal menghapus daily activity." };
  }
}
