import { db } from "@/lib/db";

export async function getMyPayslips(profileId: string) {
  return db.payslip.findMany({
    where: {
      profileId,
      status: "finalized",
      payrollPeriod: { status: { in: ["finalized", "paid"] } },
    },
    select: {
      id: true,
      employeeName: true,
      employeeNumber: true,
      departmentName: true,
      positionName: true,
      totalEarnings: true,
      totalDeductions: true,
      netSalary: true,
      payrollPeriod: { select: { month: true, year: true, status: true } },
    },
    orderBy: { payrollPeriod: { year: "desc" } },
    take: 24,
  });
}

export async function getPayslipById(id: string) {
  return db.payslip.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      payrollPeriod: { select: { month: true, year: true, status: true } },
    },
  });
}

export type MyPayslipItem = Awaited<ReturnType<typeof getMyPayslips>>[number];
export type PayslipDetail = Awaited<ReturnType<typeof getPayslipById>>;
