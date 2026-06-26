"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  submitLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  cancelLeaveSchema,
} from "@/lib/validations/leaveRequest";
import { countWeekdays, getAvailableBalance, getWeekdaysBetween } from "@/lib/leave-helpers";
import type { Prisma } from "@prisma/client";

export async function submitLeaveRequest(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`leave-submit:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = submitLeaveRequestSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const leaveType = await db.leaveType.findUnique({
      where: { id: parsed.data.leaveTypeId },
      select: {
        id: true,
        name: true,
        isActive: true,
        isDeductible: true,
        maxConsecutiveDays: true,
        minDaysBeforeRequest: true,
      },
    });
    if (!leaveType) return { success: false, error: "Jenis cuti tidak ditemukan." };
    if (!leaveType.isActive) return { success: false, error: "Jenis cuti tidak aktif." };

    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);

    if (startDate > endDate) return { success: false, error: "Tanggal mulai harus sebelum tanggal selesai." };

    const totalDays = countWeekdays(startDate, endDate);
    if (totalDays === 0) return { success: false, error: "Periode cuti tidak mengandung hari kerja." };

    if (leaveType.minDaysBeforeRequest > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + leaveType.minDaysBeforeRequest);
      if (startDate < minDate) {
        return {
          success: false,
          error: `Pengajuan cuti ${leaveType.name} harus diajukan minimal ${leaveType.minDaysBeforeRequest} hari sebelumnya.`,
        };
      }
    }

    if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
      return {
        success: false,
        error: `Maksimal ${leaveType.maxConsecutiveDays} hari berturut-turut untuk ${leaveType.name}.`,
      };
    }

    if (leaveType.isDeductible) {
      const currentYear = startDate.getFullYear();
      const balance = await db.leaveBalance.findUnique({
        where: {
          profileId_leaveTypeId_year: {
            profileId,
            leaveTypeId: leaveType.id,
            year: currentYear,
          },
        },
        select: { totalDays: true, usedDays: true, carryOverDays: true, adjustmentDays: true },
      });
      if (!balance) return { success: false, error: "Saldo cuti belum digenerate untuk tahun ini." };
      const available = getAvailableBalance(balance);
      if (totalDays > available) {
        return {
          success: false,
          error: `Saldo cuti tidak cukup. Tersedia: ${available} hari, dibutuhkan: ${totalDays} hari.`,
        };
      }
    }

    const overlap = await db.leaveRequest.findFirst({
      where: {
        profileId,
        status: { in: ["pending", "manager_approved", "approved"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlap) return { success: false, error: "Terdapat pengajuan cuti yang overlap dengan tanggal ini." };

    const request = await db.leaveRequest.create({
      data: {
        profileId,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        totalDays,
        reason: parsed.data.reason ?? null,
        status: "pending",
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "leave_request.submit",
      entityType: "leave_request",
      entityId: request.id,
      description: `Pengajuan ${leaveType.name}: ${totalDays} hari`,
    });

    revalidateTag("leave-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[submitLeaveRequest]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function managerApproveLeave(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`leave-mgr-approve:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = approveLeaveSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    // JWT only checks token existence; verify the manager's account is still active
    const callerProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!callerProfile || callerProfile.status !== "active") {
      return { success: false, error: "Akun Anda tidak aktif." };
    }

    const request = await db.leaveRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, profileId: true, profile: { select: { managerId: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };
    if (request.profile.managerId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    await db.leaveRequest.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "manager_approved",
        managerApprovedBy: profileId,
        managerApprovedAt: new Date(),
        managerNote: parsed.data.note ?? null,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "leave_request.manager_approve",
      entityType: "leave_request",
      entityId: request.id,
      description: "Manager menyetujui pengajuan cuti",
    });

    revalidateTag("leave-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerApproveLeave]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function managerRejectLeave(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`leave-mgr-reject:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rejectLeaveSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const callerProfile = await db.profile.findUnique({
      where: { id: profileId },
      select: { status: true },
    });
    if (!callerProfile || callerProfile.status !== "active") {
      return { success: false, error: "Akun Anda tidak aktif." };
    }

    const request = await db.leaveRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true, profile: { select: { managerId: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "pending") return { success: false, error: "Pengajuan sudah diproses." };
    if (request.profile.managerId !== profileId) {
      return { success: false, error: "Anda bukan manager dari karyawan ini." };
    }

    await db.leaveRequest.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "rejected",
        rejectedBy: profileId,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session.user.profileId,
      action: "leave_request.manager_reject",
      entityType: "leave_request",
      entityId: request.id,
      description: `Manager menolak pengajuan cuti: ${parsed.data.reason}`,
    });

    revalidateTag("leave-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[managerRejectLeave]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrApproveLeave(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-hr-approve:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = approveLeaveSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: { leaveType: { select: { isDeductible: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "manager_approved") {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.leaveRequest.update({
        where: { id: parsed.data.requestId },
        data: {
          status: "approved",
          hrApprovedBy: session!.user.profileId,
          hrApprovedAt: new Date(),
          hrNote: parsed.data.note ?? null,
        },
      }),
    ];

    if (request.leaveType.isDeductible) {
      const currentYear = request.startDate.getFullYear();
      const balance = await db.leaveBalance.findUnique({
        where: {
          profileId_leaveTypeId_year: {
            profileId: request.profileId,
            leaveTypeId: request.leaveTypeId,
            year: currentYear,
          },
        },
        select: { id: true, totalDays: true, usedDays: true, carryOverDays: true, adjustmentDays: true },
      });
      if (balance) {
        // Re-validate at approval time to prevent overdraft from concurrent approvals
        const available = getAvailableBalance(balance);
        if (request.totalDays > available) {
          return { success: false, error: "Saldo cuti tidak mencukupi untuk disetujui." };
        }
        ops.push(
          db.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { increment: request.totalDays } },
          })
        );
      }
    }

    const weekdays = getWeekdaysBetween(request.startDate, request.endDate);
    const existingDates = await db.attendance.findMany({
      where: { profileId: request.profileId, date: { in: weekdays } },
      select: { date: true },
    });
    const existingDateSet = new Set(existingDates.map((a) => a.date.toISOString()));

    for (const date of weekdays) {
      if (!existingDateSet.has(date.toISOString())) {
        ops.push(
          db.attendance.create({
            data: {
              profileId: request.profileId,
              date,
              status: "on_leave",
            },
          })
        );
      }
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_request.hr_approve",
      entityType: "leave_request",
      entityId: request.id,
      description: "HR menyetujui pengajuan cuti",
    });

    revalidateTag("leave-requests", "max");
    revalidateTag("leave-balances", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrApproveLeave]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function hrRejectLeave(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "hr-leave", action: "approve" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`leave-hr-reject:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = rejectLeaveSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: parsed.data.requestId },
      select: { id: true, status: true },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.status !== "manager_approved") {
      return { success: false, error: "Pengajuan belum disetujui manager." };
    }

    await db.leaveRequest.update({
      where: { id: parsed.data.requestId },
      data: {
        status: "rejected",
        rejectedBy: session!.user.profileId,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.reason,
      },
    });

    await logAudit({
      userId: session!.user.profileId,
      action: "leave_request.hr_reject",
      entityType: "leave_request",
      entityId: request.id,
      description: `HR menolak pengajuan cuti: ${parsed.data.reason}`,
    });

    revalidateTag("leave-requests", "max");
    return { success: true };
  } catch (e) {
    console.error("[hrRejectLeave]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function cancelLeaveRequest(data: unknown): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sesi tidak ditemukan." };
  if (!mutationLimiter.check(`leave-cancel:${session.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = cancelLeaveSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const profileId = session.user.profileId;
  if (!profileId) return { success: false, error: "Profile tidak ditemukan." };

  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: { leaveType: { select: { isDeductible: true } } },
    });
    if (!request) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (request.profileId !== profileId) {
      return { success: false, error: "Anda tidak berhak membatalkan pengajuan ini." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (request.startDate <= today) {
      return { success: false, error: "Tidak bisa membatalkan cuti yang sudah dimulai." };
    }

    if (
      request.status !== "pending" &&
      request.status !== "manager_approved" &&
      request.status !== "approved"
    ) {
      return { success: false, error: "Pengajuan sudah dibatalkan atau ditolak." };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.leaveRequest.update({
        where: { id: parsed.data.requestId },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: parsed.data.reason ?? null,
        },
      }),
    ];

    if (request.status === "approved") {
      if (request.leaveType.isDeductible) {
        const currentYear = request.startDate.getFullYear();
        const balance = await db.leaveBalance.findUnique({
          where: {
            profileId_leaveTypeId_year: {
              profileId,
              leaveTypeId: request.leaveTypeId,
              year: currentYear,
            },
          },
          select: { id: true },
        });
        if (balance) {
          ops.push(
            db.leaveBalance.update({
              where: { id: balance.id },
              data: { usedDays: { decrement: request.totalDays } },
            })
          );
        }
      }

      const weekdays = getWeekdaysBetween(request.startDate, request.endDate);
      ops.push(
        db.attendance.deleteMany({
          where: {
            profileId,
            date: { in: weekdays },
            status: "on_leave",
          },
        })
      );
    }

    await db.$transaction(ops);

    await logAudit({
      userId: session.user.profileId,
      action: "leave_request.cancel",
      entityType: "leave_request",
      entityId: request.id,
      description: "Pengajuan cuti dibatalkan",
    });

    revalidateTag("leave-requests", "max");
    revalidateTag("leave-balances", "max");
    return { success: true };
  } catch (e) {
    console.error("[cancelLeaveRequest]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
