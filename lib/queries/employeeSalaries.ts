import { db } from "@/lib/db";

export async function getEmployeeSalaries(params?: {
  profileId?: string;
  salaryComponentId?: string;
}) {
  const where: Record<string, unknown> = {};
  if (params?.profileId) where.profileId = params.profileId;
  if (params?.salaryComponentId) where.salaryComponentId = params.salaryComponentId;

  return db.employeeSalary.findMany({
    where,
    select: {
      id: true,
      profileId: true,
      salaryComponentId: true,
      amount: true,
      effectiveDate: true,
      endDate: true,
      profile: {
        select: {
          id: true,
          fullName: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
      salaryComponent: { select: { id: true, name: true, code: true, type: true } },
    },
    orderBy: { effectiveDate: "desc" },
    take: 1000,
  });
}

export type EmployeeSalaryItem = Awaited<ReturnType<typeof getEmployeeSalaries>>[number];
