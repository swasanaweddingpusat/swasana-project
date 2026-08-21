"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getPublicUrl } from "@/lib/storage";
import { getBaseUrl } from "@/lib/url";
import { onboardingFormSchema } from "@/lib/validations/employeeOnboarding";
import { createOnboardingFormLinkSchema } from "@/lib/validations/onboardingForm";
import { generateAccessCode } from "@/lib/access-code";
import { isAllowedUploadMimeType, MAX_UPLOAD_SIZE_BYTES } from "@/lib/validations/upload";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

const uploadedFileSchema = z.object({
  key: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
});

// ─── Submit Onboarding Form ───────────────────────────────────────────────────

export async function submitOnboardingForm(
  formData: FormData
): Promise<{ success: boolean; error?: string; message?: string }> {
  // 1. Permission check
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  // 2. Rate limit
  if (!mutationLimiter.check(`onboarding:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  // 3. Validate text fields
  const rawText = {
    fullName: formData.get("fullName"),
    nickName: formData.get("nickName"),
    joinDate: formData.get("joinDate"),
    divisi: formData.get("divisi"),
    jabatan: formData.get("jabatan"),
    venueId: formData.get("venueId"),
    placeOfBirth: formData.get("placeOfBirth"),
    dateOfBirth: formData.get("dateOfBirth"),
    phoneNumber: formData.get("phoneNumber"),
    email: formData.get("email"),
    maritalStatus: formData.get("maritalStatus"),
    ktpAddress: formData.get("ktpAddress"),
    currentAddress: formData.get("currentAddress"),
    motherName: formData.get("motherName"),
    numberOfChildren: formData.get("numberOfChildren"),
    lastEducation: formData.get("lastEducation"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactRel: formData.get("emergencyContactRel"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    bankName: formData.get("bankName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
  };

  const parsed = onboardingFormSchema.safeParse(rawText);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const {
    fullName,
    nickName,
    joinDate,
    divisi,
    jabatan,
    placeOfBirth,
    dateOfBirth,
    phoneNumber,
    email,
    maritalStatus,
    ktpAddress,
    currentAddress,
    motherName,
    numberOfChildren,
    lastEducation,
    emergencyContactName,
    emergencyContactRel,
    emergencyContactPhone,
    bankName,
    bankAccountNumber,
  } = parsed.data;

  // 4. Validate file uploads (already uploaded direct-to-storage; only metadata arrives here)
  const ktpRaw = formData.get("ktpFile");
  const kkRaw = formData.get("kkFile");

  let ktpFile: z.infer<typeof uploadedFileSchema>;
  let kkFile: z.infer<typeof uploadedFileSchema>;
  try {
    if (typeof ktpRaw !== "string") throw new Error("missing ktp");
    if (typeof kkRaw !== "string") throw new Error("missing kk");
    const ktpParsed = uploadedFileSchema.safeParse(JSON.parse(ktpRaw));
    const kkParsed = uploadedFileSchema.safeParse(JSON.parse(kkRaw));
    if (!ktpParsed.success) return { success: false, error: "File KTP wajib diunggah." };
    if (!kkParsed.success) return { success: false, error: "File KK wajib diunggah." };
    ktpFile = ktpParsed.data;
    kkFile = kkParsed.data;
  } catch {
    return { success: false, error: "File KTP/KK wajib diunggah." };
  }

  if (!ktpFile.key.startsWith("employees-documents/")) return { success: false, error: "Key file KTP tidak valid." };
  if (!kkFile.key.startsWith("employees-documents/")) return { success: false, error: "Key file KK tidak valid." };
  if (!isAllowedUploadMimeType(ktpFile.mimeType)) return { success: false, error: "Tipe file KTP tidak diizinkan." };
  if (!isAllowedUploadMimeType(kkFile.mimeType)) return { success: false, error: "Tipe file KK tidak diizinkan." };

  try {
    // 5. Resolve department — find by name or create if missing
    let department = await db.department.findFirst({
      where: { name: { equals: divisi, mode: "insensitive" } },
      select: { id: true },
    });
    if (!department) {
      department = await db.department.create({
        data: { name: divisi },
        select: { id: true },
      });
    }
    const departmentId = department.id;

    // 6. Resolve position — find by name or create if missing
    let position = await db.position.findFirst({
      where: { name: { equals: jabatan, mode: "insensitive" } },
      select: { id: true },
    });
    if (!position) {
      position = await db.position.create({
        data: { name: jabatan },
        select: { id: true },
      });
    }
    const positionId = position.id;

    // 7. Create User + Profile via nested create
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const user = await db.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        profile: {
          create: {
            email,
            fullName,
            nickName,
            phoneNumber,
            placeOfBirth,
            dateOfBirth,
            maritalStatus,
            ktpAddress,
            currentAddress,
            motherName,
            numberOfChildren,
            lastEducation,
            emergencyContactName,
            emergencyContactRel,
            emergencyContactPhone,
            bankName,
            bankAccountNumber,
            joinDate,
            departmentId,
            positionId,
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

    const profileId = user.profile!.id;

    // 8 & 9. Files already uploaded direct-to-storage by the client — resolve public URLs
    const ktpUrl = getPublicUrl(ktpFile.key);
    const kkUrl = getPublicUrl(kkFile.key);

    // 10. Create EmployeeDocument records + EmploymentHistory in one transaction
    await db.$transaction([
      db.employeeDocument.create({
        data: {
          profileId,
          type: "ktp",
          name: `KTP - ${fullName}`,
          fileUrl: ktpUrl,
          fileSize: ktpFile.fileSize,
          uploadedBy: session!.user.profileId,
        },
      }),
      db.employeeDocument.create({
        data: {
          profileId,
          type: "kk",
          name: `KK - ${fullName}`,
          fileUrl: kkUrl,
          fileSize: kkFile.fileSize,
          uploadedBy: session!.user.profileId,
        },
      }),
      db.employmentHistory.create({
        data: {
          profileId,
          changeType: "join",
          description: "Bergabung sebagai karyawan melalui form onboarding",
          newValue: fullName,
          effectiveDate: joinDate,
          createdBy: session!.user.profileId,
        },
      }),
    ]);

    // 11. Send invitation email — failure does not abort the action
    try {
      const baseUrl = await getBaseUrl();
      const verificationLink = `${baseUrl}/auth/verify?token=${token}`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Undangan Bergabung — Swasana",
        html: `<p>Halo ${fullName},</p><p>Selamat datang di Swasana! Klik link berikut untuk verifikasi email dan mengatur password Anda:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Link berlaku 7 hari.</p>`,
      });
    } catch (emailErr) {
      console.error("[submitOnboardingForm] Email send failed:", emailErr);
    }

    // 12. Audit log
    await logAudit({
      userId: session!.user.profileId,
      action: "employee.onboarding",
      entityType: "profile",
      entityId: profileId,
      description: `Karyawan ${email} di-onboard`,
      changes: { after: { email, fullName, divisi, jabatan } },
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    // 13. Invalidate caches
    revalidateTag("employees", "max");
    revalidateTag("users", "max");

    // 14. Return success
    return {
      success: true,
      message: "Karyawan berhasil di-onboard. Undangan dikirim ke email.",
    };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Email sudah terdaftar." };
    }
    console.error("[submitOnboardingForm]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Create Onboarding Form Link ─────────────────────────────────────────────

export async function createOnboardingFormLink(
  input: unknown
): Promise<{ success: boolean; error?: string; data?: { token: string; accessCode: string } }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`onboarding-link:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createOnboardingFormLinkSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { name, expiryDays } = parsed.data;

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * expiryDays);

    await db.onboardingFormLink.create({
      data: {
        name,
        token,
        accessCode,
        expiresAt,
        createdBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_form_link.create",
      entityType: "onboarding_form_link",
      entityId: token,
      description: `Form link onboarding "${name}" dibuat`,
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("onboarding", "max");

    return { success: true, data: { token, accessCode } };
  } catch (e) {
    console.error("[createOnboardingFormLink]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Regenerate Onboarding Form Link ─────────────────────────────────────────

export async function regenerateOnboardingFormLink(
  linkId: string
): Promise<{ success: boolean; error?: string; data?: { token: string; accessCode: string } }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`onboarding-link-regen:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await db.onboardingFormLink.update({
      where: { id: linkId },
      data: { token, accessCode, expiresAt, viewedAt: null, status: "Active" },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_form_link.regenerate",
      entityType: "onboarding_form_link",
      entityId: linkId,
      description: "Form link onboarding di-regenerate",
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("onboarding", "max");

    return { success: true, data: { token, accessCode } };
  } catch (e) {
    console.error("[regenerateOnboardingFormLink]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Revoke Onboarding Form Link ─────────────────────────────────────────────

export async function revokeOnboardingFormLink(
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`onboarding-link-revoke:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    await db.onboardingFormLink.update({
      where: { id: linkId },
      data: { status: "Revoked" },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "onboarding_form_link.revoke",
      entityType: "onboarding_form_link",
      entityId: linkId,
      description: "Form link onboarding di-revoke",
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("onboarding", "max");

    return { success: true };
  } catch (e) {
    console.error("[revokeOnboardingFormLink]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
