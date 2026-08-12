import { db } from "@/lib/db";

export async function getExStaff() {
  return db.profile.findMany({
    where: {
      resignDate: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      resignDate: true,
      joinDate: true,
      employmentType: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
    orderBy: { resignDate: "desc" },
    take: 200,
  });
}

export type ExStaffItem = Awaited<ReturnType<typeof getExStaff>>[number];
