import { db } from "@/lib/db";

export async function getRecruitmentRequests() {
  return db.recruitmentRequest.findMany({
    select: {
      id: true,
      fpkNumber: true,
      isWalkinInterview: true,
      company: true,
      documentDate: true,
      level: true,
      salary: true,
      quota: true,
      workLocation: true,
      startDate: true,
      status: true,
      priority: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, fullName: true } },
      formLink: {
        select: {
          id: true,
          token: true,
          accessCode: true,
          status: true,
          expiresAt: true,
          _count: { select: { submissions: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export type RecruitmentRequestItem = Awaited<ReturnType<typeof getRecruitmentRequests>>[number];
