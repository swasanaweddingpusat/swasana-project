import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

function isTableMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  if (e.code === "P2010" && String(e.message).includes("does not exist")) return true;
  return false;
}

export async function getLeaveBalances(params: {
  profileId?: string;
  leaveTypeId?: string;
  year?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.profileId) where.profileId = params.profileId;
  if (params.leaveTypeId) where.leaveTypeId = params.leaveTypeId;
  if (params.year) where.year = params.year;

  try {
    return await db.leaveBalance.findMany({
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
  } catch (e) {
    if (isTableMissing(e)) return [];
    throw e;
  }
}

export type LeaveBalanceItem = Awaited<ReturnType<typeof getLeaveBalances>>[number];
