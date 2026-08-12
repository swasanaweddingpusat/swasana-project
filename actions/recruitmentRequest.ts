"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { generateAccessCode } from "@/lib/access-code";
import {
  createRecruitmentRequestSchema,
  updateRecruitmentRequestStatusSchema,
} from "@/lib/validations/recruitmentRequest";

function generateFpkNumber(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `FPK-${mm}${yyyy}${dd}-${rand}`;
}

// ─── Create Recruitment Request ──────────────────────────────────────────────

export async function createRecruitmentRequest(
  data: unknown
): Promise<{ success: boolean; error?: string; formLink?: { token: string; accessCode: string } }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`fpk-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createRecruitmentRequestSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const fpkNumber = generateFpkNumber();
    const requestId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const [request] = await db.$transaction([
      db.recruitmentRequest.create({
        data: {
          id: requestId,
          fpkNumber,
          isWalkinInterview: parsed.data.isWalkinInterview,
          company: parsed.data.company ?? null,
          documentDate: parsed.data.documentDate ? new Date(parsed.data.documentDate) : null,
          departmentId: parsed.data.departmentId ?? null,
          positionId: parsed.data.positionId ?? null,
          level: parsed.data.level ?? null,
          salary: parsed.data.salary ?? null,
          quota: parsed.data.quota,
          workLocation: parsed.data.workLocation ?? null,
          interviewLocation: parsed.data.interviewLocation ?? null,
          trainingCompanion: parsed.data.trainingCompanion ?? null,
          startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
          minEducation: parsed.data.minEducation ?? null,
          minExperience: parsed.data.minExperience ?? null,
          otherQualifications: parsed.data.otherQualifications ?? null,
          jobDescriptions: parsed.data.jobDescriptions.filter(Boolean),
          additionalNotes: parsed.data.additionalNotes.filter(Boolean),
          priority: parsed.data.priority,
          requestedById: session!.user.profileId,
        },
      }),
      db.recruitmentFormLink.create({
        data: {
          recruitmentRequestId: requestId,
          token,
          accessCode,
          expiresAt,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "recruitment_request.create",
      entityType: "recruitment_request",
      entityId: request.id,
      description: `FPK "${fpkNumber}" dibuat`,
    });

    revalidateTag("recruitment-requests", "max");
    return { success: true, formLink: { token, accessCode } };
  } catch (e) {
    console.error("[createRecruitmentRequest]", e);
    return { success: false, error: "Gagal membuat permintaan rekrutmen." };
  }
}

// ─── Regenerate Form Link ────────────────────────────────────────────────────

export async function regenerateFormLink(
  recruitmentRequestId: string
): Promise<{ success: boolean; error?: string; formLink?: { token: string; accessCode: string } }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`fpk-regen:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.recruitmentFormLink.findUnique({
      where: { recruitmentRequestId },
      select: { id: true },
    });
    if (!existing) return { success: false, error: "Form link tidak ditemukan." };

    const token = randomBytes(32).toString("hex");
    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.recruitmentFormLink.update({
      where: { recruitmentRequestId },
      data: { token, accessCode, expiresAt, status: "Active" },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "recruitment_form_link.regenerate",
      entityType: "recruitment_request",
      entityId: recruitmentRequestId,
      description: "Form link diperbarui",
    });

    revalidateTag("recruitment-requests", "max");
    return { success: true, formLink: { token, accessCode } };
  } catch (e) {
    console.error("[regenerateFormLink]", e);
    return { success: false, error: "Gagal memperbarui form link." };
  }
}

// ─── Revoke Form Link ────────────────────────────────────────────────────────

export async function revokeFormLink(
  recruitmentRequestId: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`fpk-revoke:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.recruitmentFormLink.findUnique({
      where: { recruitmentRequestId },
      select: { id: true, status: true },
    });
    if (!existing) return { success: false, error: "Form link tidak ditemukan." };
    if (existing.status === "Revoked") return { success: false, error: "Form link sudah dinonaktifkan." };

    await db.recruitmentFormLink.update({
      where: { recruitmentRequestId },
      data: { status: "Revoked" },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "recruitment_form_link.revoke",
      entityType: "recruitment_request",
      entityId: recruitmentRequestId,
      description: "Form link dinonaktifkan",
    });

    revalidateTag("recruitment-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[revokeFormLink]", e);
    return { success: false, error: "Gagal menonaktifkan form link." };
  }
}

// ─── Update Recruitment Request Status ───────────────────────────────────────

export async function updateRecruitmentRequestStatus(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`fpk-status:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateRecruitmentRequestStatusSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.recruitmentRequest.findUnique({
      where: { id },
      select: { fpkNumber: true, status: true },
    });
    if (!existing) return { success: false, error: "Permintaan tidak ditemukan." };
    if (existing.status !== "pending") {
      return { success: false, error: "Hanya permintaan berstatus pending yang bisa diubah." };
    }

    await db.recruitmentRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        rejectionReason: parsed.data.rejectionReason ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: `recruitment_request.${parsed.data.status}`,
      entityType: "recruitment_request",
      entityId: id,
      description: `FPK "${existing.fpkNumber}" diubah ke ${parsed.data.status}`,
    });

    revalidateTag("recruitment-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateRecruitmentRequestStatus]", e);
    return { success: false, error: "Gagal mengubah status permintaan." };
  }
}
