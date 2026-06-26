import { db } from "@/lib/db";

export async function getLeaveBalances(params: {
  profileId?: string;
  leaveTypeId?: string;
  year?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.profileId) where.profileId = params.profileId;
  if (params.leaveTypeId) where.leaveTypeId = params.leaveTypeId;
  if (params.year) where.year = params.year;

  return db.leaveBalance.findMany({
    where,
    select: {
      id: true,
      profileId: true,
      leaveTypeId: true,
      year: true,
      totalDays: true,
      usedDays: true,
      carryOverDays: true,
      adjustmentDays: true,
      profile: {
        select: {
          id: true,
          fullName: true,
          employeeNumber: true,
          departmentId: true,
        },
      },
      leaveType: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [{ year: "desc" }, { leaveType: { sortOrder: "asc" } }],
    take: 1000,
  });
}

export type LeaveBalanceItem = Awaited<ReturnType<typeof getLeaveBalances>>[number];
