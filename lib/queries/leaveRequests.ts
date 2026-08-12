import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

function isTableMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  if (e.code === "P2010" && String(e.message).includes("does not exist")) return true;
  return false;
}

const requestSelect = {
  id: true,
  profileId: true,
  leaveTypeId: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  status: true,
  managerApprovedBy: true,
  managerApprovedAt: true,
  managerNote: true,
  hrApprovedBy: true,
  hrApprovedAt: true,
  hrNote: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectionReason: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  profile: {
    select: {
      id: true,
      fullName: true,
      employeeNumber: true,
      avatarUrl: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  },
  leaveType: { select: { id: true, name: true, code: true } },
  managerApprover: { select: { id: true, fullName: true } },
  hrApprover: { select: { id: true, fullName: true } },
  rejector: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestSelect;

export async function getLeaveRequests(params?: {
  status?: string;
  departmentId?: string;
  profileId?: string;
}) {
  const where: Prisma.LeaveRequestWhereInput = {};
  if (params?.status) {
    where.status = params.status as Prisma.EnumLeaveRequestStatusFilter<"LeaveRequest">;
  }
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.departmentId) {
    where.profile = { departmentId: params.departmentId };
  }

  try {
    return await db.leaveRequest.findMany({
      where,
      select: requestSelect,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getMyLeaveRequests(profileId: string) {
  try {
    return await db.leaveRequest.findMany({
      where: { profileId },
      select: requestSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getPendingForManager(managerId: string) {
  try {
    return await db.leaveRequest.findMany({
      where: {
        status: "pending",
        profile: { managerId },
      },
      select: requestSelect,
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getLeaveCalendar(params: {
  departmentId?: string;
  startDate: Date;
  endDate: Date;
}) {
  const where: Prisma.LeaveRequestWhereInput = {
    status: "approved",
    startDate: { lte: params.endDate },
    endDate: { gte: params.startDate },
  };
  if (params.departmentId) {
    where.profile = { departmentId: params.departmentId };
  }

  try {
    return await db.leaveRequest.findMany({
      where,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        profile: { select: { id: true, fullName: true, avatarUrl: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startDate: "asc" },
      take: 500,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export type LeaveRequestItem = Awaited<ReturnType<typeof getLeaveRequests>>[number];
export type LeaveCalendarItem = Awaited<ReturnType<typeof getLeaveCalendar>>[number];
