import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

function isTableMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  if (e.code === "P2010" && String(e.message).includes("does not exist")) return true;
  return false;
}

export async function getLeaveTypes() {
  try {
    return await db.leaveType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        defaultQuota: true,
        isDeductible: true,
        requiresApproval: true,
        maxConsecutiveDays: true,
        minDaysBeforeRequest: true,
        isCarryOver: true,
        carryOverMaxDays: true,
        carryOverExpiryMonths: true,
        isActive: true,
        isSystemType: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export async function getAllLeaveTypes() {
  try {
    return await db.leaveType.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        defaultQuota: true,
        isDeductible: true,
        requiresApproval: true,
        maxConsecutiveDays: true,
        minDaysBeforeRequest: true,
        isCarryOver: true,
        carryOverMaxDays: true,
        carryOverExpiryMonths: true,
        isActive: true,
        isSystemType: true,
        sortOrder: true,
        _count: { select: { requests: true } },
      },
      orderBy: { sortOrder: "asc" },
      take: 100,
    });
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export type LeaveTypeItem = Awaited<ReturnType<typeof getLeaveTypes>>[number];
export type LeaveTypeAdminItem = Awaited<ReturnType<typeof getAllLeaveTypes>>[number];
