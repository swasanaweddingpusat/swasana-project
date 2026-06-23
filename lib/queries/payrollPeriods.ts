import { db } from "@/lib/db";

export async function getPayrollPeriods() {
  return db.payrollPeriod.findMany({
    select: {
      id: true,
      month: true,
      year: true,
      status: true,
      totalEmployees: true,
      totalGrossAmount: true,
      totalNetAmount: true,
      generatedAt: true,
      finalizedAt: true,
      paidAt: true,
      notes: true,
      generator: { select: { fullName: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 100,
  });
}

export async function getPayrollPeriodById(id: string) {
  return db.payrollPeriod.findUnique({
    where: { id },
    include: {
      generator: { select: { fullName: true } },
      finalizer: { select: { fullName: true } },
      payslips: {
        select: {
          id: true,
          profileId: true,
          employeeName: true,
          employeeNumber: true,
          departmentName: true,
          totalEarnings: true,
          totalDeductions: true,
          netSalary: true,
          pph21Amount: true,
          bpjsKesEmployee: true,
          jhtEmployee: true,
          jpEmployee: true,
          status: true,
        },
        orderBy: { employeeNumber: "asc" },
      },
    },
  });
}

export type PayrollPeriodItem = Awaited<ReturnType<typeof getPayrollPeriods>>[number];
export type PayrollPeriodDetail = Awaited<ReturnType<typeof getPayrollPeriodById>>;
