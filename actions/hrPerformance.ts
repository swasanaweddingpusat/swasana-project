"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  createPerformanceReviewSchema,
  updatePerformanceReviewSchema,
  createKpiSchema,
  updateKpiSchema,
} from "@/lib/validations/hrPerformance";

// ─── Performance Review ───────────────────────────────────────────────────────

export async function createPerformanceReview(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`perf-review-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createPerformanceReviewSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const review = await db.performanceReview.create({
      data: {
        profileId: parsed.data.profileId,
        periodStartDate: parsed.data.periodStartDate,
        periodEndDate: parsed.data.periodEndDate,
        rating: parsed.data.rating,
        strengths: parsed.data.strengths,
        comments: parsed.data.comments,
        status: parsed.data.status,
      },
      select: { id: true },
    });

    await logAudit({
      userId: session!.user.id,
      action: "performance_review.created",
      result: "success",
      entityType: "PerformanceReview",
      entityId: review.id,
      description: "Performance review created",
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[createPerformanceReview]", err);
    return { success: false, error: "Gagal membuat review kinerja." };
  }
}

export async function updatePerformanceReview(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`perf-review-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updatePerformanceReviewSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.performanceReview.update({
      where: { id },
      data: {
        periodStartDate: parsed.data.periodStartDate,
        periodEndDate: parsed.data.periodEndDate,
        rating: parsed.data.rating,
        strengths: parsed.data.strengths,
        comments: parsed.data.comments,
        status: parsed.data.status,
      },
    });

    await logAudit({
      userId: session!.user.id,
      action: "performance_review.updated",
      result: "success",
      entityType: "PerformanceReview",
      entityId: id,
      description: "Performance review updated",
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[updatePerformanceReview]", err);
    return { success: false, error: "Gagal memperbarui review kinerja." };
  }
}

export async function deletePerformanceReview(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`perf-review-delete:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    await db.performanceReview.delete({ where: { id } });

    await logAudit({
      userId: session!.user.id,
      action: "performance_review.deleted",
      result: "success",
      entityType: "PerformanceReview",
      entityId: id,
      description: "Performance review deleted",
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[deletePerformanceReview]", err);
    return { success: false, error: "Gagal menghapus review kinerja." };
  }
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export async function createKpi(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`kpi-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createKpiSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const kpi = await db.kpi.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        department: parsed.data.department,
        targetValue: parsed.data.targetValue,
        achievedValue: parsed.data.achievedValue,
        unit: parsed.data.unit,
        periodStartDate: parsed.data.periodStartDate,
        periodEndDate: parsed.data.periodEndDate,
        progressPercentage: parsed.data.progressPercentage,
      },
      select: { id: true },
    });

    await logAudit({
      userId: session!.user.id,
      action: "kpi.created",
      result: "success",
      entityType: "Kpi",
      entityId: kpi.id,
      description: `KPI "${parsed.data.name}" created`,
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[createKpi]", err);
    return { success: false, error: "Gagal membuat KPI." };
  }
}

export async function updateKpi(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`kpi-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateKpiSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.kpi.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        department: parsed.data.department,
        targetValue: parsed.data.targetValue,
        achievedValue: parsed.data.achievedValue,
        unit: parsed.data.unit,
        periodStartDate: parsed.data.periodStartDate,
        periodEndDate: parsed.data.periodEndDate,
        progressPercentage: parsed.data.progressPercentage,
      },
    });

    await logAudit({
      userId: session!.user.id,
      action: "kpi.updated",
      result: "success",
      entityType: "Kpi",
      entityId: id,
      description: "KPI updated",
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[updateKpi]", err);
    return { success: false, error: "Gagal memperbarui KPI." };
  }
}

export async function deleteKpi(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };

  if (!mutationLimiter.check(`kpi-delete:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  try {
    await db.kpi.delete({ where: { id } });

    await logAudit({
      userId: session!.user.id,
      action: "kpi.deleted",
      result: "success",
      entityType: "Kpi",
      entityId: id,
      description: "KPI deleted",
    });

    revalidateTag("hr-performance");
    return { success: true };
  } catch (err) {
    console.error("[deleteKpi]", err);
    return { success: false, error: "Gagal menghapus KPI." };
  }
}
