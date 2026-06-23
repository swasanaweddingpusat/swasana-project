"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { createJobPostingSchema, updateJobPostingSchema } from "@/lib/validations/jobPosting";

// ─── Create Job Posting ───────────────────────────────────────────────────────

export async function createJobPosting(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createJobPostingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const posting = await db.jobPosting.create({
      data: {
        ...parsed.data,
        departmentId: parsed.data.departmentId || null,
        positionId: parsed.data.positionId || null,
        createdBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.create",
      entityType: "job_posting",
      entityId: posting.id,
      description: `Lowongan "${posting.title}" dibuat`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[createJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Job Posting ───────────────────────────────────────────────────────

export async function updateJobPosting(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateJobPostingSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const updateData = {
      ...parsed.data,
      ...(parsed.data.departmentId !== undefined ? { departmentId: parsed.data.departmentId || null } : {}),
      ...(parsed.data.positionId !== undefined ? { positionId: parsed.data.positionId || null } : {}),
    };

    const posting = await db.jobPosting.update({ where: { id }, data: updateData });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.update",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" diperbarui`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Job Posting ───────────────────────────────────────────────────────

export async function deleteJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.findUnique({
      where: { id },
      select: { title: true, _count: { select: { candidates: true } } },
    });
    if (!posting) return { success: false, error: "Lowongan tidak ditemukan." };
    if (posting._count.candidates > 0) {
      return {
        success: false,
        error: "Tidak bisa menghapus lowongan yang sudah memiliki kandidat.",
      };
    }

    await db.jobPosting.delete({ where: { id } });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.delete",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" dihapus`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Publish Job Posting ──────────────────────────────────────────────────────

export async function publishJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-publish:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.update({
      where: { id },
      data: { status: "open", openDate: new Date() },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.publish",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" dipublikasikan`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[publishJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Close Job Posting ────────────────────────────────────────────────────────

export async function closeJobPosting(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`job-close:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const posting = await db.jobPosting.update({
      where: { id },
      data: { status: "closed", closeDate: new Date() },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "job_posting.close",
      entityType: "job_posting",
      entityId: id,
      description: `Lowongan "${posting.title}" ditutup`,
    });

    revalidateTag("job-postings", "max");
    return { success: true };
  } catch (e) {
    console.error("[closeJobPosting]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
