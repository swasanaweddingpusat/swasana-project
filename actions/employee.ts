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
import { uploadToR2, deleteFromR2, extractKeyFromUrl } from "@/lib/r2";
import { getBaseUrl } from "@/lib/url";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  uploadDocumentSchema,
  addHistorySchema,
} from "@/lib/validations/employee";
import type { Prisma } from "@prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@swasana.com";

// ─── Create Employee ──────────────────────────────────────────────────────────

export async function createEmployee(
  data: unknown
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "create" });
  if (error) return { success: false, error };

  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown";

  if (!mutationLimiter.check(`emp-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createEmployeeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const {
    email,
    fullName,
    nickName,
    gender,
    phoneNumber,
    nik,
    kkNumber,
    placeOfBirth,
    dateOfBirth,
    religion,
    bloodType,
    ktpAddress,
    currentAddress,
    city,
    motherName,
    maritalStatus,
    numberOfChildren,
    lastEducation,
    emergencyContactName,
    emergencyContactRel,
    emergencyContactPhone,
    bankName,
    bankAccountNumber,
    bankAccountHolder,
    npwp,
    bpjsKesehatan,
    bpjsKetenagakerjaan,
    roleId,
    managerId,
    dataScope,
    departmentId,
    positionId,
    employmentType,
    joinDate,
    contractStartDate,
    contractEndDate,
  } = parsed.data;

  try {
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Nested create is atomic on Neon HTTP adapter — avoids callback transaction form.
    const user = await db.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        profile: {
          create: {
            email,
            fullName,
            nickName: nickName ?? null,
            gender: gender ?? null,
            phoneNumber: phoneNumber ?? null,
            nik: nik ?? null,
            kkNumber: kkNumber ?? null,
            placeOfBirth: placeOfBirth ?? null,
            dateOfBirth: dateOfBirth ?? null,
            religion: religion ?? null,
            bloodType: bloodType ?? null,
            ktpAddress: ktpAddress ?? null,
            currentAddress: currentAddress ?? null,
            city: city ?? null,
            motherName: motherName ?? null,
            maritalStatus: maritalStatus ?? null,
            numberOfChildren: numberOfChildren ?? null,
            lastEducation: lastEducation ?? null,
            emergencyContactName: emergencyContactName ?? null,
            emergencyContactRel: emergencyContactRel ?? null,
            emergencyContactPhone: emergencyContactPhone ?? null,
            bankName: bankName ?? null,
            bankAccountNumber: bankAccountNumber ?? null,
            bankAccountHolder: bankAccountHolder ?? null,
            npwp: npwp ?? null,
            bpjsKesehatan: bpjsKesehatan ?? null,
            bpjsKetenagakerjaan: bpjsKetenagakerjaan ?? null,
            roleId: roleId ?? null,
            managerId: managerId ?? null,
            dataScope: dataScope ?? "own",
            departmentId: departmentId ?? null,
            positionId: positionId ?? null,
            employmentType: employmentType ?? null,
            joinDate: joinDate ?? null,
            contractStartDate: contractStartDate ?? null,
            contractEndDate: contractEndDate ?? null,
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

    if (joinDate) {
      await db.employmentHistory.create({
        data: {
          profileId,
          changeType: "join",
          description: "Bergabung sebagai karyawan",
          newValue: fullName,
          effectiveDate: joinDate,
          createdBy: session!.user.profileId,
        },
      });
    }

    // Send invitation email — outside DB write so mail failure doesn't roll back user creation
    try {
      const baseUrl = await getBaseUrl();
      const verificationLink = `${baseUrl}/auth/verify?token=${token}`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Undangan Bergabung — Swasana",
        html: `<p>Halo ${fullName},</p><p>Anda diundang untuk bergabung ke Swasana. Klik link berikut untuk verifikasi email dan mengatur password:</p><p><a href="${verificationLink}">${verificationLink}</a></p><p>Link berlaku 7 hari.</p>`,
      });
    } catch (emailErr) {
      console.error("[createEmployee] Email send failed:", emailErr);
    }

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.create",
      entityType: "profile",
      entityId: profileId,
      description: `Karyawan ${email} ditambahkan`,
      changes: { after: { email, fullName, departmentId, positionId, employmentType } },
      ipAddress: ip,
      userAgent: h.get("user-agent") ?? undefined,
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true, message: "Karyawan berhasil ditambahkan. Undangan dikirim ke email." };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return { success: false, error: "Email sudah terdaftar." };
    }
    console.error("[createEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Update Employee ──────────────────────────────────────────────────────────

export async function updateEmployee(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateEmployeeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const current = await db.profile.findUnique({
      where: { id },
      select: {
        userId: true,
        departmentId: true,
        positionId: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
    if (!current) return { success: false, error: "Karyawan tidak ditemukan." };

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.profile.update({ where: { id }, data: parsed.data }),
    ];

    const now = new Date();

    if (
      parsed.data.departmentId !== undefined &&
      parsed.data.departmentId !== current.departmentId
    ) {
      const newDept = parsed.data.departmentId
        ? await db.department.findUnique({
            where: { id: parsed.data.departmentId },
            select: { name: true },
          })
        : null;
      ops.push(
        db.employmentHistory.create({
          data: {
            profileId: id,
            changeType: "transfer",
            description: "Pindah departemen",
            oldValue: current.department?.name ?? "-",
            newValue: newDept?.name ?? "-",
            effectiveDate: now,
            createdBy: session!.user.profileId,
          },
        })
      );
    }

    if (
      parsed.data.positionId !== undefined &&
      parsed.data.positionId !== current.positionId
    ) {
      const newPos = parsed.data.positionId
        ? await db.position.findUnique({
            where: { id: parsed.data.positionId },
            select: { name: true },
          })
        : null;
      ops.push(
        db.employmentHistory.create({
          data: {
            profileId: id,
            changeType: "promotion",
            description: "Perubahan posisi",
            oldValue: current.position?.name ?? "-",
            newValue: newPos?.name ?? "-",
            effectiveDate: now,
            createdBy: session!.user.profileId,
          },
        })
      );
    }

    if (parsed.data.fullName) {
      ops.push(
        db.user.update({
          where: { id: current.userId },
          data: { name: parsed.data.fullName },
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.update",
      entityType: "profile",
      entityId: id,
      description: "Data karyawan diperbarui",
      changes: { after: parsed.data },
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Delete Employee (soft delete) ────────────────────────────────────────────

export async function deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const profile = await db.profile.findUnique({
      where: { id },
      select: { fullName: true, email: true },
    });
    if (!profile) return { success: false, error: "Karyawan tidak ditemukan." };

    await db.$transaction([
      db.profile.update({
        where: { id },
        data: { status: "inactive", resignDate: new Date() },
      }),
      db.employmentHistory.create({
        data: {
          profileId: id,
          changeType: "resign",
          description: "Status diubah menjadi tidak aktif",
          oldValue: "active",
          newValue: "inactive",
          effectiveDate: new Date(),
          createdBy: session!.user.profileId,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.delete",
      entityType: "profile",
      entityId: id,
      description: `Karyawan "${profile.fullName}" dinonaktifkan`,
    });

    revalidateTag("employees", "max");
    revalidateTag("users", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployee]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Upload Employee Document ─────────────────────────────────────────────────

export async function uploadEmployeeDocument(
  profileId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-doc-upload:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "File wajib diunggah." };

  const metaParsed = uploadDocumentSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name") || file.name,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!metaParsed.success) return { success: false, error: metaParsed.error.issues[0].message };

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) return { success: false, error: "Ukuran file maks 10MB." };

  try {
    const ext = file.name.split(".").pop() ?? "bin";
    const key = `employees/${profileId}/documents/${metaParsed.data.type}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadToR2(buffer, key, file.type);

    const doc = await db.employeeDocument.create({
      data: {
        profileId,
        type: metaParsed.data.type,
        name: metaParsed.data.name,
        fileUrl,
        fileSize: file.size,
        expiresAt: metaParsed.data.expiresAt ?? null,
        uploadedBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.document_upload",
      entityType: "employee_document",
      entityId: doc.id,
      description: `Dokumen "${metaParsed.data.name}" diunggah untuk karyawan ${profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[uploadEmployeeDocument]", e);
    return { success: false, error: "Terjadi kesalahan saat mengunggah." };
  }
}

// ─── Delete Employee Document ─────────────────────────────────────────────────

export async function deleteEmployeeDocument(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-doc-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const doc = await db.employeeDocument.findUnique({
      where: { id: docId },
      select: { id: true, name: true, fileUrl: true, profileId: true },
    });
    if (!doc) return { success: false, error: "Dokumen tidak ditemukan." };

    try {
      await deleteFromR2(extractKeyFromUrl(doc.fileUrl));
    } catch (r2Err) {
      console.error("[deleteEmployeeDocument] R2 delete failed:", r2Err);
    }

    await db.employeeDocument.delete({ where: { id: docId } });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.document_delete",
      entityType: "employee_document",
      entityId: docId,
      description: `Dokumen "${doc.name}" dihapus dari karyawan ${doc.profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteEmployeeDocument]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

// ─── Add Employment History ───────────────────────────────────────────────────

export async function addEmploymentHistory(
  profileId: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`emp-history:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addHistorySchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const entry = await db.employmentHistory.create({
      data: {
        profileId,
        changeType: parsed.data.changeType,
        description: parsed.data.description,
        oldValue: parsed.data.oldValue ?? null,
        newValue: parsed.data.newValue ?? null,
        effectiveDate: parsed.data.effectiveDate,
        createdBy: session!.user.profileId,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "employee.history_add",
      entityType: "employment_history",
      entityId: entry.id,
      description: `Riwayat "${parsed.data.changeType}" ditambahkan untuk karyawan ${profileId}`,
    });

    revalidateTag("employees", "max");
    return { success: true };
  } catch (e) {
    console.error("[addEmploymentHistory]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
