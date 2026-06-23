import { db } from "@/lib/db";

export async function getDepartments(): Promise<DepartmentItem[]> {
  return db.department.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      head: { select: { id: true, fullName: true } },
      _count: { select: { profiles: true, children: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export async function getDepartmentTree(): Promise<DepartmentItem[]> {
  return db.department.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
      head: { select: { id: true, fullName: true } },
      _count: { select: { profiles: true, children: true } },
    },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export type DepartmentItem = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  head: { id: string; fullName: string | null } | null;
  _count: { profiles: number; children: number };
};
