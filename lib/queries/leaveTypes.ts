import { db } from "@/lib/db";

export async function getLeaveTypes() {
  return db.leaveType.findMany({
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
}

export async function getAllLeaveTypes() {
  return db.leaveType.findMany({
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
}

export type LeaveTypeItem = Awaited<ReturnType<typeof getLeaveTypes>>[number];
export type LeaveTypeAdminItem = Awaited<ReturnType<typeof getAllLeaveTypes>>[number];
