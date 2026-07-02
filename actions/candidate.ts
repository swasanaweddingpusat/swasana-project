"use server";

import { revalidateTag } from "next/cache";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getBaseUrl } from "@/lib/url";
import {
  addCandidateSchema,
  moveCandidateStageSchema,
  rejectCandidateSchema,
  rateCandidateSchema,
  addCandidateNoteSchema,
} from "@/lib/validations/candidate";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

// ─── Add Candidate ────────────────────────────────────────────────────────────

export async function addCandidate(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-add:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addCandidateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const candidate = await db.candidate.create({
      data: {
        jobPostingId: parsed.data.jobPostingId,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phoneNumber: parsed.data.phoneNumber ?? null,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.add",
      entityType: "candidate",
      entityId: candidate.id,
      description: `Kandidat "${parsed.data.fullName}" ditambahkan`,
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Kandidat dengan email ini sudah terdaftar untuk lowongan ini." };
    }
    console.error("[addCandidate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Candidate ─────────────────────────────────────────────────────────

export async function updateCandidate(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addCandidateSchema.partial().safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.candidate.update({ where: { id }, data: parsed.data });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.update",
      entityType: "candidate",
      entityId: id,
      description: "Data kandidat diperbarui",
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateCandidate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Move Candidate Stage ─────────────────────────────────────────────────────

export async function moveCandidateStage(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-stage:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = moveCandidateStageSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.candidate.update({
      where: { id: parsed.data.candidateId },
      data: { stage: parsed.data.stage },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.stage_move",
      entityType: "candidate",
      entityId: parsed.data.candidateId,
      description: `Tahap kandidat diubah ke "${parsed.data.stage}"`,
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    console.error("[moveCandidateStage]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Hire Candidate ───────────────────────────────────────────────────────────

export async function hireCandidate(
  candidateId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "hire" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-hire:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    // 1. Get candidate + jobPosting data
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId },
      include: {
        jobPosting: {
          select: {
            departmentId: true,
            positionId: true,
            employmentType: true,
          },
        },
      },
    });
    if (!candidate) return { success: false, error: "Kandidat tidak ditemukan." };
    if (candidate.stage === "hired") return { success: false, error: "Kandidat sudah diterima." };

    // 2. Check email not already registered
    const existingUser = await db.user.findUnique({ where: { email: candidate.email } });
    if (existingUser) {
      return { success: false, error: "Email kandidat sudah terdaftar sebagai karyawan." };
    }

    // 3. Create User + Profile
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const user = await db.user.create({
      data: {
        email: candidate.email,
        name: candidate.fullName,
        password: hashedPassword,
        profile: {
          create: {
            email: candidate.email,
            fullName: candidate.fullName,
            phoneNumber: candidate.phoneNumber ?? null,
            departmentId: candidate.jobPosting?.departmentId ?? null,
            positionId: candidate.jobPosting?.positionId ?? null,
            employmentType: candidate.jobPosting?.employmentType ?? null,
            joinDate: new Date(),
            isEmailVerified: false,
            mustChangePassword: true,
            invitedAt: new Date(),
            invitedBy: session!.user.profileId,
            emailVerificationTokens: {
              create: { token, expiresAt },
            },
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });

    const newProfileId = user.profile!.id;

    // 4. Update candidate: stage=hired, hiredAt=now, hiredProfileId
    // If this fails, roll back the created user to avoid orphaned accounts.
    try {
      await db.candidate.update({
        where: { id: candidateId },
        data: {
          stage: "hired",
          hiredAt: new Date(),
          hiredProfileId: newProfileId,
        },
      });
    } catch (updateErr) {
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
      throw updateErr;
    }

    // 5. Auto-assign default OnboardingTemplate if one exists
    const defaultTemplate = await db.onboardingTemplate.findFirst({
      where: { isDefault: true, isActive: true },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });

    if (defaultTemplate) {
      const startDate = new Date();
      const assignment = await db.onboardingAssignment.create({
        data: {
          profileId: newProfileId,
          templateId: defaultTemplate.id,
          startDate,
          status: "in_progress",
        },
      });

      if (defaultTemplate.tasks.length > 0) {
        await db.$transaction(
          defaultTemplate.tasks.map((task) => {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + task.dueInDays);
            return db.onboardingTask.create({
              data: {
                assignmentId: assignment.id,
                templateTaskId: task.id,
                title: task.title,
                description: task.description ?? null,
                dueDate,
                assignTo: task.assignTo,
                sortOrder: task.sortOrder,
              },
            });
          })
        );
      }

      revalidateTag("onboarding", "max");
    }

    // 6. Send invite email
    try {
      const baseUrl = await getBaseUrl();
      const verificationLink = `${baseUrl}/auth/verify?token=${token}`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: candidate.email,
        subject: "Selamat! Anda Diterima — Swasana",
        html: `<p>Halo ${candidate.fullName},</p><p>Selamat! Anda telah diterima bekerja di Swasana. Klik link berikut untuk verifikasi email dan mengatur password:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Link berlaku 7 hari.</p>`,
      });
    } catch (emailErr) {
      console.error("[hireCandidate] Email send failed:", emailErr);
    }

    // 7. Audit log
    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.hire",
      entityType: "candidate",
      entityId: candidateId,
      description: `Kandidat "${candidate.fullName}" diterima dan akun karyawan dibuat`,
      changes: { after: { profileId: newProfileId, email: candidate.email } },
    });

    revalidateTag("candidates", "max");
    revalidateTag("employees", "max");
    return { success: true, message: "Kandidat diterima. Undangan dikirim ke email." };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Email sudah terdaftar." };
    }
    console.error("[hireCandidate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Reject Candidate ─────────────────────────────────────────────────────────

export async function rejectCandidate(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-reject:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rejectCandidateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.candidate.update({
      where: { id: parsed.data.candidateId },
      data: { stage: "rejected", rejectionReason: parsed.data.reason },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.reject",
      entityType: "candidate",
      entityId: parsed.data.candidateId,
      description: "Kandidat ditolak",
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    console.error("[rejectCandidate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Candidate Note ───────────────────────────────────────────────────────

export async function addCandidateNote(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-note:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addCandidateNoteSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const note = await db.candidateNote.create({
      data: {
        candidateId: parsed.data.candidateId,
        content: parsed.data.content,
        createdBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.note_add",
      entityType: "candidate_note",
      entityId: note.id,
      description: "Catatan kandidat ditambahkan",
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    console.error("[addCandidateNote]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Rate Candidate ───────────────────────────────────────────────────────────

export async function rateCandidate(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-recruitment", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`candidate-rate:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rateCandidateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    await db.candidate.update({
      where: { id: parsed.data.candidateId },
      data: { rating: parsed.data.rating },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "candidate.rate",
      entityType: "candidate",
      entityId: parsed.data.candidateId,
      description: `Kandidat diberi rating ${parsed.data.rating}`,
    });

    revalidateTag("candidates", "max");
    return { success: true };
  } catch (e) {
    console.error("[rateCandidate]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
