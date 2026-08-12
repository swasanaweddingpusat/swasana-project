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
      interviewLocation: true,
      trainingCompanion: true,
      startDate: true,
      minEducation: true,
      minExperience: true,
      otherQualifications: true,
      jobDescriptions: true,
      additionalNotes: true,
      status: true,
      priority: true,
      rejectionReason: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, fullName: true } },
      approver1: { select: { id: true, fullName: true } },
      approver2: { select: { id: true, fullName: true } },
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
