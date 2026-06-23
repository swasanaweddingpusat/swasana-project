import { db } from "@/lib/db";

export async function getSalaryComponents() {
  return db.salaryComponent.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    take: 100,
  });
}

export async function getAllSalaryComponents() {
  return db.salaryComponent.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      category: true,
      isFixed: true,
      isTaxable: true,
      isActive: true,
      isSystemType: true,
      sortOrder: true,
      _count: { select: { employeeSalaries: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 100,
  });
}

export type SalaryComponentItem = Awaited<ReturnType<typeof getSalaryComponents>>[number];
export type SalaryComponentAdminItem = Awaited<ReturnType<typeof getAllSalaryComponents>>[number];
