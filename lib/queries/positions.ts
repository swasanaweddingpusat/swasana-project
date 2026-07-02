import { db } from "@/lib/db";

export async function getPositions(departmentId?: string): Promise<PositionItem[]> {
  const where = departmentId ? { departmentId, isActive: true } : { isActive: true };

  return db.position.findMany({
    where,
    select: {
      id: true,
      name: true,
      departmentId: true,
      level: true,
      sortOrder: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      _count: { select: { profiles: true } },
    },
    orderBy: [{ sortOrder: "asc" }],
    take: 500,
  });
}

export type PositionItem = {
  id: string;
  name: string;
  departmentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  department: { id: string; name: string } | null;
  _count: { profiles: number };
};
